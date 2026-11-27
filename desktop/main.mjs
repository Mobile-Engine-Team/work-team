import { app, BrowserWindow, dialog, Menu, nativeImage, session, shell, Tray } from 'electron'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { accessSync, constants, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { installMenu } from './menu.mjs'

const exec = promisify(execFile)
const profile = process.argv.includes('--workbench-profile=b') ? 'b' : 'a'
const product = join(process.resourcesPath, 'product')
const installation = JSON.parse(readFileSync(join(process.resourcesPath, 'installation.json'), 'utf8'))
const replay = process.argv.includes('--workbench-isolated-replay')
let base = join(app.getPath('appData'), 'DSH Team Workbench')
try {
  accessSync(installation.runtime, constants.W_OK | constants.X_OK)
  base = installation.runtime
} catch { /* A copied app on another account creates its own writable data. */ }
const runtime = replay ? join(base,'isolated-replay') : base
const profileDir = join(runtime, profile)
const data = join(profileDir, 'desktop')
const origin = 'http://127.0.0.1:' + ((replay ? 19116 : 19016) + (profile === 'a' ? 0 : 1))
process.umask(0o077)
await mkdir(data, { recursive: true })
app.setPath('userData', data)
app.commandLine.appendSwitch('lang', 'en-US')
app.setName('团队工作台')
app.setAboutPanelOptions({applicationName: 'MobileWork_公众版_DEV'})
let win, tray, broker, socketDir
let quitting = false
let loading = false
let saveTimer
const boundsFile = join(data, 'window-state.json')

function reveal() {
  if (!win || win.isDestroyed()) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}
async function connect() {
  if (loading) return
  loading = true
  try {
    const args = [join(product, 'scripts/local'), 'start', profile]
    if (process.argv.includes('--workbench-fixture')) args.push('--fixture')
    await exec('/usr/bin/python3', args, {
      env: { HOME: app.getPath('home'), PATH: '/usr/bin:/bin:/usr/sbin:/sbin', WORKBENCH_RUNTIME: runtime, WORKBENCH_TEST_LAB: replay ? '1' : '0', ...(replay && process.argv.includes('--workbench-work-mock') ? { MOBILEWORK_WORK_ADAPTER: 'mock' } : {}) },
      timeout: 140000,
    })
    const entry = new URL((await readFile(join(profileDir, 'entry.private'), 'utf8')).trim())
    if (entry.origin !== origin || entry.pathname !== '/' || !entry.searchParams.has('token')) throw Error('entry')
    await win.loadURL(entry.href)
  } catch {
    const result = await dialog.showMessageBox(win, { type: 'error', title: '团队工作台',
      message: '无法连接本机工作台', detail: '请检查本机协作服务与端口，修复后可重新连接。\n' + join(runtime, 'logs'),
      buttons: ['重新连接', '退出'], defaultId: 0, cancelId: 1 })
    if (result.response === 0) setImmediate(connect)
    else app.quit()
  } finally { loading = false }
}

// Only this profile's Host can reach the socket in its private directory. The page never sees file paths.
async function startDialogBroker() {
  socketDir = await mkdtemp('/tmp/team-workbench-')
  const address = join(socketDir, 'dialogs.sock')
  broker = createServer(async (req, res) => {
    try {
      if (req.method !== 'POST' || req.url !== '/dialog') throw Error()
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 8192) throw Error()
      }
      const { type, host, fingerprint } = JSON.parse(body)
      let value
      reveal()
      if (type === 'key' || type === 'model-auth') {
        const result = await dialog.showOpenDialog(win, type === 'key'
          ? { title: '选择 SSH 私钥', properties: ['openFile','showHiddenFiles'] }
          : { properties: ['openFile','showHiddenFiles'], filters: [{ name: 'Codex auth.json', extensions: ['json'] }] })
        value = result.canceled ? null : result.filePaths[0]
      } else if (type === 'trust' && typeof host === 'string' && typeof fingerprint === 'string') {
        const result = await dialog.showMessageBox(win, { type: 'question', title: '连接远程主机', message: '确认连接 ' + host + '？',
          detail: '请核对主机指纹：\n' + fingerprint + '\n确认后保存此指纹；指纹变化时将拒绝连接。',
          buttons: ['取消','信任并连接'], defaultId: 0, cancelId: 0 })
        value = result.response === 1
      } else throw Error()
      res.end(JSON.stringify(value))
    } catch { res.writeHead(400).end() }
  })
  await new Promise((resolve,reject) => broker.once('error',reject).listen(address,resolve))
  const tmp = join(data,'dialog-socket.tmp')
  await writeFile(tmp,address,{ mode: 0o600 })
  await rename(tmp,join(data,'dialog-socket'))
}
async function open() {
  let bounds = { width: 1180, height: 810 }
  try {
    const saved = JSON.parse(await readFile(boundsFile,'utf8'))
    if (Number.isFinite(saved.width) && Number.isFinite(saved.height) && saved.width >= 700 && saved.height >= 520) bounds = saved
  } catch {}
  win = new BrowserWindow({ ...bounds, minWidth: 700, minHeight: 520, useContentSize: true,
    title: '团队工作台' + (profile === 'b' ? ' B' : ''), titleBarStyle: 'hidden', show: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  win.on('page-title-updated', event => event.preventDefault())
  const persist = () => {
    if (quitting || win.isFullScreen() || win.isMaximized() || win.isMinimized()) return
    clearTimeout(saveTimer)
    const bounds = win.getContentBounds()
    saveTimer = setTimeout(() => writeFile(boundsFile,JSON.stringify(bounds)).catch(() => {}),200)
  }
  win.on('resize',persist).on('move',persist)
  win.on('close', event => { if (!quitting && tray) { event.preventDefault(); win.hide() } })
  win.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault() })
  win.webContents.setWindowOpenHandler(({ url }) => {
    try { if (['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) void shell.openExternal(url) } catch {}
    return {action:'deny'}
  })
  const icon = nativeImage.createFromPath(join(process.resourcesPath,'tray.png')).resize({width:18,height:18})
  if (!icon.isEmpty()) {
    tray = new Tray(icon)
    tray.setToolTip('团队工作台')
    tray.setContextMenu(Menu.buildFromTemplate([{label:'显示主窗口', click:reveal},{type:'separator'},{label:'退出',click:() => app.quit()}]))
    tray.on('click',reveal)
  }
  installMenu(reveal, command => win.webContents.send('workbench:native-menu',command))
  await startDialogBroker()
  await session.defaultSession.cookies.remove(origin + '/api/workbench','team_workbench_' + profile)
  await connect()
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance',reveal)
  app.on('activate',reveal)
  app.on('before-quit',() => { quitting = true; broker?.close() })
  app.on('will-quit',() => { if (socketDir) void rm(socketDir,{recursive:true,force:true}) })
  app.on('window-all-closed',() => app.quit())
  app.whenReady().then(open).catch(() => {
    dialog.showErrorBox('团队工作台','无法打开本机工作台，请检查客户端资料目录。')
    app.quit()
  })
}
