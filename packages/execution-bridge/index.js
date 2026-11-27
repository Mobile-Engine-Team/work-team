import { protectedRoute } from '@team-workbench/multica-host/service'
import { json, WorkbenchError, workspacePath } from '@team-workbench/multica-host/service'
import { daemonController } from './daemon.js'

export const inject = ['connection', 'workbenchMultica']

export function apply(ctx) {
  const service = ctx.workbenchMultica
  const control = daemonController(service.directory)
  const lifecycle = {
    'team:enableDaemon': 'daemon.start', 'team:daemonStatus': 'daemon.status', 'team:stopDaemon': 'daemon.stop', 'team:daemonLogs': 'daemon.logs',
  }
  const actions = new Set([...Object.keys(lifecycle), 'team:serverInfo', 'team:personalLinks', 'team:savePersonalLink',
    'team:modelAuthStatus', 'team:loginModel', 'team:importModelAuth', 'team:testAgent', 'team:connectRemote'])
  protectedRoute(ctx, '/api/workbench/desktop', async (request, {action, payload = {}}) => {
    if (!actions.has(action)) throw new WorkbenchError(404, '未知桌面操作。')
    const auth = await service.authorize(request)
    try {
      const result = action === 'team:serverInfo'
        ? { serverUrl: process.env.WORKBENCH_API }
        : await control(lifecycle[action] || action, auth, payload)
      await auth.finish()
      return json({ok:true, ...result})
    } catch (error) {
      await auth.finish()
      return json({ok:false, error:error instanceof Error ? error.message : '桌面操作失败。'})
    }
  })
  protectedRoute(ctx, '/api/workbench/execution', async (request, { operation, workspaceId }) => {
    const auth = await service.authorize(request)
    if (operation === 'daemon.start') {
      await auth.call('GET', workspacePath(workspaceId) + '/')
      await auth.finish()
    }
    if (!['daemon.status', 'daemon.start', 'daemon.stop'].includes(operation)) {
      throw new WorkbenchError(404, '未知执行端操作。')
    }
    const value = await control(operation, auth)
    await auth.finish()
    return json(value)
  })
}
