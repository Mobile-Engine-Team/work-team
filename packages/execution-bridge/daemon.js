import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { createTeamModelAuth } from './team-model-auth.js'
import { createTeamPersonal } from './team-personal.js'
import { nativeDialog } from './dialogs.js'
import { promisify } from 'node:util'
import { WorkbenchError, id, upstream } from '@team-workbench/multica-host/service'

const exec = promisify(execFile)
const inactive = 'disabled-executor'
const blocked = ['ANTIGRAVITY', 'CLAUDE', 'CODEARTS', 'CODEBUDDY', 'COPILOT', 'CURSOR', 'DEVECO',
  'DEVIN', 'DIM', 'DSH', 'GROK', 'HERMES', 'KIMI', 'KIRO', 'MCODE', 'MC', 'MUSE', 'OPENCLAW',
  'OPENCODE', 'OMP', 'PI', 'QODERCLICN', 'QODER', 'QWENPAW', 'QWEN', 'REASONIX', 'TRAECLI', 'ZCODE', 'ZEROCLAW']
const identityPath = directory => join(directory, 'identity.json')
const profileName = identity => identity.profile || 'workbench'
const configPath = (directory, identity) => join(directory, '.multica', 'profiles', profileName(identity), 'config.json')
const credentialPath = directory => join(directory, 'credential.json')
const binary = () => process.env.WORKBENCH_MULTICA_BIN
const fixture = () => process.env.WORKBENCH_FIXTURE
const origin = () => process.env.WORKBENCH_API
const managedPi = () => process.env.WORKBENCH_MANAGED_PI
const piSettings = directory => join(directory, 'workbench-pi')

async function read(file) {
  try { return JSON.parse(await readFile(file, 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}

async function remove(file) {
  await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error })
}

async function save(file, value) {
  const temp = file + '.' + randomUUID() + '.tmp'
  await writeFile(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' })
  await rename(temp, file)
}

function cliEnv(directory, identity) {
  const replay = process.env.WORKBENCH_ENROLL_FIXTURE === '1'
  const env = {
    HOME: directory, USERPROFILE: directory, MULTICA_CONFIG_HOME: directory,
    PATH: replay ? '/usr/bin:/bin:/usr/sbin:/sbin' : process.env.PATH,
    SHELL: '/bin/sh', TMPDIR: process.env.TMPDIR, CODEX_HOME: join(directory, '.codex'),
    MULTICA_DAEMON_ID: identity.daemonId, MULTICA_LAUNCHED_BY: 'team-workbench',
    MULTICA_DAEMON_AUTO_UPDATE: 'false', MULTICA_DAEMON_AUTO_RELOAD: 'false', DO_NOT_TRACK: '1',
  }
  if (replay) {
    for (const provider of blocked) env['MULTICA_' + provider + '_PATH'] = join(directory, inactive)
    for (const provider of ['CLAUDE','OPENCODE','PI']) {
      env['MULTICA_' + provider + '_PATH'] = join(dirname(fixture()), 'fixture-cli')
    }
    Object.assign(env, {
      MULTICA_CODEX_PATH: fixture(), MULTICA_CODEX_MODEL: 'workbench-fixture',
      MULTICA_AGENT_RUNTIME_NAME: 'Workbench Fixture', MULTICA_DAEMON_DEVICE_NAME: 'Workbench Fixture',
    })
  } else if (managedPi()) {
    Object.assign(env, {
      MULTICA_PI_PATH: managedPi(),
      PI_CODING_AGENT_DIR: piSettings(directory),
      PI_OFFLINE: '1',
    })
  }
  return env
}

async function configurePi(directory) {
  if (!managedPi() || process.env.WORKBENCH_ENROLL_FIXTURE === '1') return
  const dest = piSettings(directory)
  const config = await read(join(process.env.WORKBENCH_RUNTIME, 'model.private.json'))
  if (!config) {
    await remove(join(dest, 'models.json'))
    await remove(join(dest, 'settings.json'))
    return
  }
  const { baseUrl, model, apiKey } = config
  if (![baseUrl, model, apiKey].every(value => typeof value === 'string' && value.trim()) || apiKey.startsWith('!')) {
    throw new WorkbenchError(400, '本机模型配置无效。请重新运行 scripts/deploy model。')
  }
  await mkdir(dest, { recursive: true, mode: 0o700 })
  await save(join(dest, 'models.json'), {
    providers: {
      workbench: {
        baseUrl, apiKey, api: 'openai-completions',
        compat: { supportsDeveloperRole: false, supportsStore: false },
        models: [{ id: model, reasoning: false, contextWindow: 65536, maxTokens: 10000 }],
      },
    },
  })
  await save(join(dest, 'settings.json'), { defaultProvider: 'workbench', defaultModel: model })
}

async function cli(directory, identity, args) {
  const env = cliEnv(directory, identity)
  try {
    const { stdout } = await exec(binary(), ['daemon', ...args, '--profile', profileName(identity)],
      { env, cwd: directory, timeout: 65_000, maxBuffer: 1024 * 1024 })
    return stdout
  } catch {
    throw new WorkbenchError(503, '本机执行端命令未能完成。请检查本产品的执行端日志后刷新。')
  }
}

async function state(directory, identity) {
  if (!identity) return { state: 'stopped' }
  const health = JSON.parse(await cli(directory, identity, ['status', '--output', 'json']))
  if (health.port_conflict || (['running', 'starting'].includes(health.status) &&
      (health.daemon_id !== identity.daemonId || health.launched_by !== 'team-workbench' ||
       health.server_url !== identity.origin || health.profile !== profileName(identity)))) {
    throw new WorkbenchError(409, '本机执行端身份或端口冲突。')
  }
  return { state: health.status, daemonId: identity.daemonId }
}

async function verify(directory, userId) {
  const identity = await read(identityPath(directory))
  if (identity && (identity.owner !== userId || identity.origin !== origin() ||
      typeof identity.daemonId !== 'string' ||
      (identity.profile !== undefined && !/^wb-[a-f0-9]{16}$/.test(identity.profile)))) throw new WorkbenchError(409, '执行端登记与当前账号不匹配。')
  return identity
}

async function revokeCredential(directory, identity, call) {
  const file = configPath(directory, identity)
  const config = await read(file)
  const credential = await read(credentialPath(directory))
  const tokenId = credential?.id || config?.token_id
  if (tokenId) {
    if (call) await call('DELETE', '/api/tokens/' + id(tokenId)).catch(error => {
      if (error.status !== 404) throw error
    })
    else await upstream(origin())('DELETE', '/api/tokens/' + id(tokenId), { token: config?.token })
      .catch(error => { if (![401, 404].includes(error.status)) throw error })
  }
  await remove(credentialPath(directory))
  await remove(file)
}

async function stop(directory, identity, call) {
  const current = await state(directory, identity)
  if (!identity) return current
  if (current.state !== 'stopped') await cli(directory, identity, ['stop'])
  await revokeCredential(directory, identity, call)
  return { state: 'stopped', daemonId: identity.daemonId }
}

export async function stopOwnedDaemons(root) {
  let users
  try { users = await readdir(root, { withFileTypes: true }) }
  catch (error) { if (error.code === 'ENOENT') return; throw error }
  for (const user of users.filter(item => item.isDirectory())) {
    const directory = join(root, id(user.name))
    await stop(directory, await verify(directory, user.name))
  }
}

async function testAgent(auth, args, directory, identity) {
  const userId = auth.user.id
  if (!identity || (await state(directory,identity)).state !== 'running') throw Error('TEAM_ENDPOINT_OFFLINE')
  const workspaces = await auth.call('GET','/api/workspaces/')
  const workspace = workspaces.find(space => space.slug === args.workspaceSlug)
  if (!workspace) throw Error('Cannot verify agent access')
  const scoped = {workspaceId:workspace.id}
  const agent = (await auth.call('GET', '/api/agents/', scoped)).find(item => item.id === args.agentId)
  if (!agent || agent.owner_id !== userId) throw Error("Cannot test another owner's agent")
  const runtime = (await auth.call('GET', '/api/runtimes/', scoped)).find(item => item.id === agent.runtime_id)
  if (!runtime || runtime.owner_id !== userId || runtime.daemon_id !== identity.daemonId) throw Error('TEAM_PROBE_REMOTE')
  if (runtime.status !== 'online') throw Error('TEAM_ENDPOINT_OFFLINE')
  if (agent.status !== 'idle') throw Error('TEAM_AGENT_BUSY')
  const result = JSON.parse(await cli(directory,identity,['test-connection','--provider',runtime.provider,
    '--model',agent.model || '', '--directory',join(directory,'diagnostics')]))
  return {ok:true, passed:result.passed === true, reason:String(result.reason || ''),
    provider:runtime.provider, model:agent.model || '', checkedAt:new Date().toISOString()}
}

async function connectRemote(auth, args, directory) {
  const userId = auth.user.id
  const { createTeamRemote, validateRemoteHost } = await import('./team-remote.js')
  validateRemoteHost(args)
  await mkdir(directory,{recursive:true,mode:0o700})
  const remote = createTeamRemote({userDataDir:directory,serverUrl:origin(),
    confirmHost:(host,fingerprint) => nativeDialog('trust',{host,fingerprint}),
    chooseKey:async () => {
      const file = await nativeDialog('key')
      return file ? readFile(file) : null
    },
  })
  const credential = await auth.call('POST','/api/tokens/',{body:{name:'Workbench remote daemon',expires_in_days:1}})
  try {
    return await remote.connect({...args, serverUrl:origin(),userId,token:credential.token})
  } catch (error) {
    await auth.call('DELETE','/api/tokens/' + id(credential.id))
    throw error
  }
}

export function daemonController(root) {
  const locks = new Map()
  const agents = new Map()
  const personal = new Map()
  return async function control(operation, auth, args = {}) {
    const userId = id(auth.user.id)
    const directory = join(root, userId)
    const previous = locks.get(userId) || Promise.resolve()
    const job = previous.catch(() => {}).then(async () => {
      let identity = await verify(directory, userId)
      if (operation === 'daemon.status') return state(directory, identity)
      if (operation === 'daemon.stop') {
        agents.get(userId)?.cancel()
        return stop(directory, identity, auth.call)
      }
      if (operation === 'team:personalLinks' || operation === 'team:savePersonalLink') {
        if (!personal.has(userId)) personal.set(userId,createTeamPersonal({accountRoot: () => directory}))
        return personal.get(userId).handle(operation, { ...args, teamUserId: userId, serverUrl: origin() })
      }
      if (['team:modelAuthStatus','team:loginModel','team:importModelAuth'].includes(operation)) {
        const status = await state(directory,identity)
        const inactive = { configured:false, signingIn:false, loginError:false }
        if (status.state !== 'running') return { ok:true, ...status, daemonId:identity?.daemonId || null, ...inactive }
        if (!agents.has(userId)) agents.set(userId,createTeamModelAuth({chooseAuthFile: () => nativeDialog('model-auth')}))
        const env = cliEnv(directory,identity)
        return {ok:true, ...status, ...await agents.get(userId).handle(operation,{home:env.CODEX_HOME,env})}
      }
      if (operation === 'team:testAgent') return testAgent(auth, args, directory, identity)
      if (operation === 'team:connectRemote') return connectRemote(auth, args, directory)
      if (operation !== 'daemon.start') throw new WorkbenchError(404, '未知执行端操作。')
      if ((await auth.call('GET', '/api/me')).id !== userId) throw new WorkbenchError(403, '执行端登记身份有误。')
      await Promise.all([access(binary()), access(fixture())])
      const current = await state(directory, identity)
      if (current.state === 'running' || current.state === 'starting') return current
      if (!identity) {
        identity = { owner: userId, daemonId: randomUUID(), origin: origin(),
          profile: 'wb-' + randomUUID().replaceAll('-', '').slice(0, 16) }
        await mkdir(directory, { recursive: true, mode: 0o700 })
        await save(identityPath(directory), identity)
      }
      await configurePi(directory)
      await mkdir(join(directory, '.multica', 'profiles', profileName(identity)), { recursive: true, mode: 0o700 })
      await revokeCredential(directory, identity, auth.call)
      const credential = await auth.call('POST', '/api/tokens/', {
        body: { name: 'Workbench daemon ' + identity.daemonId.slice(0, 8), expires_in_days: 1 },
      })
      const config = { server_url: origin(), token: credential.token,
        workspaces_root: join(directory, 'workspaces') }
      try {
        await save(credentialPath(directory), { id: credential.id })
        await save(configPath(directory, identity), config)
      } catch {
        await auth.call('DELETE', '/api/tokens/' + id(credential.id))
        await remove(credentialPath(directory))
        throw new WorkbenchError(503, '无法保存本机执行端登记资料。')
      }
      const start = ['start', '--no-auto-update', '--no-auto-reload']
      if (process.env.WORKBENCH_ENROLL_FIXTURE === '1') {
        start.push('--poll-interval', '1s', '--heartbeat-interval', '3s', '--agent-timeout', '45s')
      }
      await cli(directory, identity, start)
      const status = await state(directory, identity)
      if (status.state !== 'running') throw new WorkbenchError(503, '执行端尚未启动，请刷新状态。')
      return status
    })
    locks.set(userId, job)
    try { return await job }
    finally { if (locks.get(userId) === job) locks.delete(userId) }
  }
}
