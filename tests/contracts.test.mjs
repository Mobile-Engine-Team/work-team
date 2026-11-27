import assert from 'node:assert/strict'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { protectedRoute } from '../packages/multica-host/index.js'
import { sessionStore } from '../packages/multica-host/session.js'
import { tasks } from '../packages/multica-host/tasks.js'
import { upstream } from '../packages/multica-host/upstream.js'

test('business operations construct scoped paths and ignore incoming upstream override fields', async () => {
  const workspaceId = '00000000-0000-4000-8000-000000000001'
  const id = '00000000-0000-4000-8000-000000000002'
  const requests = []
  const call = (...args) => requests.push(args)
  await tasks['issues.list']({
    call, workspaceId, args: { filters: { q: 'a & b', status: 'todo', workspace_id: 'foreign', sort: 'due_date' } },
  })
  assert.deepEqual(requests[0], ['GET', '/api/issues/?q=a+%26+b&status=todo&sort=due_date', { workspaceId, body: undefined }])
  await tasks['issues.update']({ call, workspaceId, args: { id, data: { title: 'test', suppress_run: false, origin_type: 'untrusted' } } })
  assert.deepEqual(requests[1], ['PUT', '/api/issues/' + id + '/', { workspaceId, body: { title: 'test', suppress_run: true } }])
  assert.throws(() => tasks['issues.get']({ call, workspaceId: 'bogus', args: { id } }), /有效的记录/)
  assert.throws(() => upstream('https://example.com:8080'), /invalid isolated API/)
})

test('exact protected route validates provenance and JSON before running a business operation', async () => {
  let registered
  const ctx = { effect: setup => setup(), connection: { fetch: { register: route => { registered = route } } } }
  protectedRoute(ctx, '/api/workbench/operation', async (_request, body) => Response.json(body))
  const options = { method: 'POST', headers: { host: '127.0.0.1:18996', 'content-type': 'application/json' },
    body: '{"operation":"example"}' }
  const internal = 'http://dsh.internal/api/workbench/operation'
  const request = (origin, body = options.body) => new Request(internal, {
    ...options, body, headers: { ...options.headers, origin },
  })
  assert.equal((await registered.fetch(request('http://127.0.0.1:18997'))).status, 403)
  assert.equal((await registered.fetch(request('http://127.0.0.1:18996', '[]'))).status, 400)
  assert.deepEqual(await (await registered.fetch(request('http://127.0.0.1:18996'))).json(), { operation: 'example' })
})

test('host keeps browser session files private, isolated by client and revocable', async () => {
  const state = await mkdtemp(join(tmpdir(), 'workbench-contract-'))
  try {
    const a = sessionStore(join(state, 'a'), 'a')
    const b = sessionStore(join(state, 'b'), 'b')
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 10 })).toString('base64url')
    const cookie = await a.create('x.' + payload + '.x', { id: 'actor' })
    assert.match(cookie, /HttpOnly; SameSite=Strict/)
    const request = new Request('http://127.0.0.1/api/workbench/operation', { headers: { cookie: cookie.split(';')[0] } })
    const session = await a.get(request)
    assert.equal(session.user.id, 'actor')
    assert.equal((await stat(join(state, 'a', 'sessions', session.id))).mode & 0o777, 0o600)
    assert.equal(await b.get(request), undefined)
    await a.remove(session.id)
    assert.equal(await a.get(request), undefined)
  } finally {
    await rm(state, { recursive: true, force: true })
  }
})

test('deterministic provider reports a local terminal receipt through the app-server protocol', () => {
  const task = spawnSync('scripts/fixture-codex', ['app-server', '--listen', 'stdio://'], {
    input: [
      { id: 1, method: 'initialize' },
      { id: 2, method: 'thread/start' },
      { id: 3, method: 'model/list' },
      { id: 4, method: 'turn/start' },
    ].map(value => JSON.stringify(value)).join('\n') + '\n',
    encoding: 'utf8',
    env: { PATH: '/usr/bin:/bin' },
  })
  assert.equal(task.status, 0)
  const frames = task.stdout.trim().split('\n').map(line => JSON.parse(line))
  assert.ok(frames.find(frame => frame.id === 2).result.thread.id)
  assert.equal(frames.find(frame => frame.id === 3).result.data[0].id, 'workbench-fixture')
  assert.equal(frames.find(frame => frame.method === 'item/completed').params.item.text, 'WORKBENCH_FIXTURE_OK')
  assert.equal(frames.find(frame => frame.method === 'turn/completed').params.turn.status, 'completed')
})
