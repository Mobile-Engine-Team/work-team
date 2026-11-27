export class WorkbenchError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const id = value => {
  if (typeof value !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)) {
    throw new WorkbenchError(400, '缺少有效的记录 ID')
  }
  return value
}

export function workspacePath(workspaceId) {
  return '/api/workspaces/' + id(workspaceId)
}

export function json(value, status = 200, headers) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store', ...headers } })
}

export function endpoint(method, path, scoped = false) {
  return ({ call, workspaceId, args }) => call(method,
    typeof path === 'function' ? path(args, workspaceId) : path,
    { workspaceId: scoped ? id(workspaceId) : undefined, body: method === 'GET' ? undefined : args.data })
}

export function upstream(origin) {
  const url = new URL(origin)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/' || !url.port ||
      url.username || url.password || url.search || url.hash) throw new Error('invalid isolated API origin')

  return async function call(method, path, { token, workspaceId, body, signal } = {}) {
    const headers = { accept: 'application/json' }
    if (token) headers.authorization = 'Bearer ' + token
    if (workspaceId) headers['X-Workspace-ID'] = workspaceId
    if (body !== undefined) headers['content-type'] = 'application/json'
    let response
    try {
      response = await fetch(url.origin + path, {
        method, headers, redirect: 'error',
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(12_000)]) : AbortSignal.timeout(12_000),
      })
    } catch (error) {
      const timeout = error.name === 'TimeoutError'
      throw new WorkbenchError(timeout ? 504 : 503, timeout ? '协作服务响应超时，请刷新确认结果。' : '协作服务暂时不可用，请稍后刷新。')
    }
    if (response.status === 204) return null
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const message = response.status === 401 ? '登录已失效或账号密码有误。' :
        response.status === 403 ? '当前账号没有权限执行此操作。' :
        response.status === 404 ? '找不到该记录，或你已失去访问权限。' :
        response.status >= 500 ? '协作服务未能处理该操作。' :
        typeof payload?.error === 'string' ? payload.error : '协作服务拒绝了该操作。'
      throw new WorkbenchError(response.status, message)
    }
    return payload
  }
}
