import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const identifier = /^[A-Za-z0-9_-]{43}$/
const capacityMs = 12 * 60 * 60 * 1000

export function sessionStore(state, client) {
  const dir = join(state, 'sessions')
  const cookieName = 'team_workbench_' + client

  function cookie(id, age) {
    return `${cookieName}=${id}; Path=/api/workbench; HttpOnly; SameSite=Strict; Max-Age=${age}`
  }

  async function get(request) {
    const cookies = (request.headers.get('cookie') || '').split(';').map(item => item.trim())
    const id = cookies.find(item => item.startsWith(cookieName + '='))?.split('=')[1]
    if (!identifier.test(id || '')) return undefined
    try {
      const session = JSON.parse(await readFile(join(dir, id), 'utf8'))
      if (session.expires <= Date.now()) {
        await remove(id)
        return undefined
      }
      return { ...session, id }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }

  async function remove(id) {
    if (identifier.test(id || '')) {
      await unlink(join(dir, id)).catch(error => { if (error.code !== 'ENOENT') throw error })
    }
  }

  async function create(token, user) {
    const expiry = Number(JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).exp) * 1000
    const expires = Math.min(expiry, Date.now() + capacityMs)
    if (!Number.isFinite(expires) || expires <= Date.now()) throw new Error('invalid session expiry')
    const id = randomBytes(32).toString('base64url')
    await mkdir(dir, { recursive: true, mode: 0o700 })
    const temp = join(dir, id + '.tmp')
    await writeFile(temp, JSON.stringify({ token, user, expires }), { mode: 0o600, flag: 'wx' })
    await rename(temp, join(dir, id))
    return cookie(id, Math.floor((expires - Date.now()) / 1000))
  }

  return { get, remove, create, expiredCookie: cookie('', 0) }
}
