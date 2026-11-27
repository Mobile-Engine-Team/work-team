// The renderer owns Multica's wire schemas. The local DSH Host owns credentials,
// the upstream address, and the lifetime of the account's subscriptions.
import { json, WorkbenchError } from './upstream.js'

const collections = new Set([
  'agent-task-snapshot', 'agents', 'config', 'chat', 'comments', 'attachments', 'inbox', 'invitations', 'issue-statuses',
  'issues', 'issue-views', 'labels', 'me', 'model-probes', 'pins', 'projects', 'runtimes', 'squads', 'task-drafts', 'tasks',
  'upload-file', 'workbench', 'workspaces',
])
const requestHeaders = ['accept', 'content-type', 'x-workspace-id', 'x-workspace-slug', 'x-request-id', 'range']
const responseHeaders = ['content-type', 'content-disposition', 'content-range', 'accept-ranges']

function sameClient(request) {
  const origin = request.headers.get('origin')
  if ((origin && origin !== 'http://' + request.headers.get('host')) ||
      request.headers.get('sec-fetch-site') === 'cross-site') throw new WorkbenchError(403, '请求来源不受信任。')
}

export function businessTarget(origin, path) {
  if (!path?.startsWith('/api/')) throw new WorkbenchError(404, '未知业务路径。')
  const target = new URL(path, origin)
  if (target.origin !== origin || target.hash || !collections.has(target.pathname.split('/')[2])) {
    throw new WorkbenchError(404, '未知业务路径。')
  }
  return target
}

function liftedMethod(request) {
  const value = request.headers.get('x-workbench-method')
  if (!value) return request.method
  if (request.method === 'POST' && ['PATCH', 'PUT', 'DELETE'].includes(value)) return value
  throw new WorkbenchError(405, '不支持的请求方式。')
}

async function forward(request, url, session, signal) {
  const headers = new Headers({ authorization: 'Bearer ' + session.token })
  for (const key of requestHeaders) {
    if (request.headers.has(key)) headers.set(key, request.headers.get(key))
  }
  const method = liftedMethod(request)
  const response = await fetch(url, {
    method, headers, body: request.body, duplex: 'half', redirect: 'manual', signal,
  })
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel()
    throw new WorkbenchError(502, '协作服务返回了意外的跳转。')
  }
  const output = new Headers({
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; sandbox",
  })
  for (const key of responseHeaders) {
    if (response.headers.has(key)) output.set(key, response.headers.get(key))
  }
  return new Response(response.body, { status: response.status, headers: output })
}

function workspaceEvents(url, session, signal) {
  const workspace = url.searchParams.get('workspace')
  if (!workspace) throw new WorkbenchError(400, '缺少工作区。')
  const endpoint = new URL('/ws', url.origin)
  endpoint.protocol = 'ws:'
  endpoint.searchParams.set('workspace_slug', workspace)
  const socket = new WebSocket(endpoint)
  const encoder = new TextEncoder()
  let done = false
  let cleanup
  const body = new ReadableStream({
    start(controller) {
      const send = text => { if (!done) controller.enqueue(encoder.encode(text)) }
      // An initial comment flushes the response on a quiet workspace.
      send(': connected\n\n')
      const pulse = setInterval(() => send(': keepalive\n\n'), 15000)
      cleanup = (cancelledByReader = false) => {
        if (done) return
        done = true
        clearInterval(pulse)
        signal.removeEventListener('abort', onClosed)
        socket.close()
        if (!cancelledByReader) controller.close()
      }
      const onClosed = () => cleanup()
      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', payload: { token: session.token } }))
      socket.onmessage = ({ data }) => {
        try {
          const event = JSON.parse(data)
          if (typeof event?.type === 'string') send('data: ' + JSON.stringify(event) + '\n\n')
        } catch { /* Ignore unrecognized upstream frames. */ }
      }
      socket.onerror = onClosed
      socket.onclose = onClosed
      signal.addEventListener('abort', onClosed, { once: true })
      if (signal.aborted) cleanup()
    },
    cancel() { cleanup(true) },
  })
  return new Response(body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' } })
}

export function installTransport(ctx, origin, sessions) {
  const controllers = new Map()
  function revoke(id) {
    controllers.get(id)?.abort()
    controllers.delete(id)
  }
  ctx.effect(() => () => { for (const id of controllers.keys()) revoke(id) })
  function route(path, methods, handle) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: '/api/workbench/' + path, methods, requestBody: 'buffered',
      async fetch(request) {
        try {
          sameClient(request)
          const session = await sessions.get(request)
          if (!session) throw new WorkbenchError(401, '请登录工作台。')
          let account = controllers.get(session.id)
          if (!account) {
            account = new AbortController()
            controllers.set(session.id, account)
            const expiry = setTimeout(() => revoke(session.id), Math.max(1, session.expires - Date.now()))
            expiry.unref()
            account.signal.addEventListener('abort', () => clearTimeout(expiry), { once: true })
          }
          return await handle(request, session, AbortSignal.any([request.signal, account.signal]))
        } catch (error) {
          if (error instanceof WorkbenchError) return json({ error: error.message }, error.status)
          return json({ error: '协作服务暂时不可用。' }, 503)
        }
      },
    }))
  }
  const relay = (request, session, signal) =>
    forward(request, businessTarget(origin, new URL(request.url).searchParams.get('path')), session, signal)
  // DSH's streaming request carrier always supplies a body, invalid on GET/HEAD.
  route('transport', ['GET', 'HEAD', 'POST'], relay)
  route('events', ['GET'], (request, session, signal) => {
    const url = new URL(origin)
    url.search = new URL(request.url).search
    return workspaceEvents(url, session, signal)
  })
  return revoke
}
