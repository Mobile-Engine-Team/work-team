import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { installTransport, businessTarget } from '../packages/multica-host/transport.js'

test('DSH transport relays workspace, method and raw body using the signed-in account', async t => {
  const api = createServer(async (request, response) => {
    assert.equal(request.method, 'PATCH')
    assert.equal(request.url, '/api/projects/project?revision=2')
    assert.equal(request.headers.authorization, 'Bearer fixture')
    assert.equal(request.headers.cookie, undefined)
    assert.equal(request.headers['x-workspace-slug'], 'team')
    for await (const chunk of request) assert.equal(chunk.toString(), 'fixture bytes')
    response.writeHead(409, { 'content-type': 'application/json', 'set-cookie': 'upstream=ignored' })
    response.end('{"error":"version conflict"}')
  })
  api.listen(0, '127.0.0.1')
  await once(api, 'listening')
  t.after(() => api.close())
  const origin = 'http://127.0.0.1:' + api.address().port
  const routes = new Map()
  const ctx = { effect: setup => setup(), connection: { fetch: { register: route => routes.set(route.path, route) } } }
  const revoke = installTransport(ctx, origin, { get: async req => req.headers.has('cookie')
    ? { id: 'synthetic', token: 'fixture', expires: Date.now() + 60000 } : undefined })
  t.after(() => revoke('synthetic'))
  const route = routes.get('/api/workbench/transport')
  const url = 'http://host/api/workbench/transport?path=' + encodeURIComponent('/api/projects/project?revision=2')
  assert.equal((await route.fetch(new Request(url))).status, 401)
  const result = await route.fetch(new Request(url, { method: 'POST', body: 'fixture bytes', headers: {
    'x-workbench-method': 'PATCH', authorization: 'ignored', cookie: 'local=session', 'x-workspace-slug': 'team',
  } }))
  assert.equal(result.status, 409)
  assert.equal(result.headers.get('set-cookie'), null)
  assert.deepEqual(await result.json(), { error: 'version conflict' })
  assert.throws(() => businessTarget(origin, '/api/tokens'), /业务路径/)
})
