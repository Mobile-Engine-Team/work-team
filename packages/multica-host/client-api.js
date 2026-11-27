export const WORKBENCH_ROUTE = '/api/workbench/operation'
export const EXECUTION_ROUTE = '/api/workbench/execution'
export const FIXTURE_RUNTIME_NAME = 'Codex (Workbench Fixture)'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function invoke(operation, args = {}, { workspaceId, signal, route = WORKBENCH_ROUTE } = {}) {
  let response
  try {
    response = await fetch(route, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operation, workspaceId, args }), signal, cache: 'no-store',
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, '无法连接本机 Host，请刷新重试。')
  }
  const payload = await response.json().catch(() => undefined)
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ||
      (response.status === 401 ? '请通过本机启动入口打开工作台。' : '本机 Host 暂时不可用。'))
  }
  return payload
}
