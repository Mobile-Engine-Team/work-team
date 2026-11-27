import { installTransport } from './transport.js'
import { join } from 'node:path'
import { sessionStore } from './session.js'
import { upstream, json, WorkbenchError } from './upstream.js'
import { workspaces } from './workspaces.js'
import { tasks } from './tasks.js'
import { inbox } from './inbox.js'
import { members } from './members.js'
import { squads } from './squads.js'

export const inject = ['connection']
const operations = Object.assign(Object.create(null), workspaces, tasks, inbox, members, squads)

export function protectedRoute(ctx, path, handler) {
  ctx.effect(() => ctx.connection.fetch.register({
    path, methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      try {
        const hostname = request.headers.get('host')
        const origin = request.headers.get('origin')
        if ((origin && origin !== 'http://' + hostname) ||
            request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new WorkbenchError(403, '请求来源不受信任。')
        }
        if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
          throw new WorkbenchError(415, '请求必须使用 JSON。')
        }
        const raw = await request.text()
        if (raw.length > 256 * 1024) throw new WorkbenchError(413, '请求内容超过工作台限制。')
        let body
        try { body = JSON.parse(raw) } catch {
          throw new WorkbenchError(400, '请求格式无效。')
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new WorkbenchError(400, '请求格式无效。')
        }
        return await handler(request, body)
      } catch (error) {
        if (error instanceof WorkbenchError) return json({ error: error.message }, error.status)
        return json({ error: '本机 Host 未能处理该操作。' }, 500)
      }
    },
  }))
}

export function apply(ctx) {
  const { WORKBENCH_STATE: state, WORKBENCH_CLIENT: client, WORKBENCH_API: origin } = process.env
  if (!state || !['a', 'b'].includes(client)) throw new Error('missing isolated workbench profile')
  const sessions = sessionStore(state, client)
  const api = upstream(origin)
  const revoke = installTransport(ctx, new URL(origin).origin, sessions)
  async function clearSession(request) {
    const previous = await sessions.get(request)
    revoke(previous?.id)
    await sessions.remove(previous?.id)
  }
  async function authorize(request) {
    const session = await sessions.get(request)
    if (!session) throw new WorkbenchError(401, '请登录工作台。')
    return {
      user: session.user,
      call: (method, path, options) => api(method, path, {
        ...options, token: session.token, signal: method === 'GET' ? request.signal : undefined,
      }),
      async finish() {
        if ((await sessions.get(request))?.id !== session.id) throw new WorkbenchError(401, '登录已退出。')
      },
    }
  }
  ctx.provide('workbenchMultica', { authorize, directory: join(state, 'daemons') })
  protectedRoute(ctx, '/api/workbench/operation', async (request, { operation, workspaceId, args = {} }) => {
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw new WorkbenchError(400, '参数格式无效。')
    if (operation === 'session.logout') {
      const previous = await sessions.get(request)
      if (previous) await api('POST', '/auth/logout', { token: previous.token })
      await clearSession(request)
      return json(null, 200, { 'set-cookie': sessions.expiredCookie })
    }
    if (operation === 'session.login' || operation === 'session.register') {
      const mode = operation.slice('session.'.length)
      const { token, user } = await api('POST', '/auth/password/' + mode, {
        body: { username: args.username, password: args.password },
      })
      const data = await api('GET', '/api/workspaces/', { token })
      await clearSession(request)
      return json({ user, workspaces: data }, 200, { 'set-cookie': await sessions.create(token, user) })
    }
    const auth = await authorize(request)
    let result
    if (operation === 'session.current') {
      const [user, data] = await Promise.all([auth.call('GET', '/api/me'), auth.call('GET', '/api/workspaces/')])
      result = { user, workspaces: data }
    } else {
      if (typeof operations[operation] !== 'function') throw new WorkbenchError(404, '未知工作台操作。')
      result = await operations[operation]({ ...auth, workspaceId, args })
    }
    await auth.finish()
    return json(result)
  })
}
