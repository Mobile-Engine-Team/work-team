import { app, Menu } from 'electron'
import { localizeApplicationMenu } from './application-menu-locale.mjs'

const separator = { type: 'separator' }
const roles = (...items) => items.map(role => ({ role }))

// Roles carry the macOS responder-chain behavior and native keyboard equivalents.
export function installMenu(reveal, send) {
  const name = 'MobileWork_公众版_DEV'
  const template = [
    { label: app.name, submenu: [
      { role: 'about', label: 'About ' + name }, separator,
      { id: 'settings', label: 'Settings…', accelerator: 'Command+,', click() { reveal(); send('settings') } },
      separator, ...roles('services'), separator, ...roles('hide', 'hideOthers', 'unhide'), separator, ...roles('quit'),
    ] },
    { id: 'file', label: 'File', submenu: roles('close') },
    { id: 'edit', label: 'Edit', submenu: [
      ...roles('undo', 'redo'), separator, ...roles('cut', 'copy', 'paste', 'pasteAndMatchStyle', 'delete', 'selectAll'),
      separator, { id: 'speech', label: 'Speech', submenu: roles('startSpeaking', 'stopSpeaking') },
    ] },
    { id: 'view', label: 'View', submenu: [
      { id: 'sidebar', label: 'Toggle Sidebar', accelerator: 'Command+B', click() { send('sidebar') } },
      separator, ...roles('reload', 'forceReload', 'toggleDevTools'), separator, ...roles('resetZoom', 'zoomIn', 'zoomOut'),
      separator, ...roles('togglefullscreen'),
    ] },
    { id: 'window', label: 'Window', submenu: [
      ...roles('minimize', 'zoom'), separator, ...roles('front'), separator, ...roles('window'),
    ] },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(localizeApplicationMenu(template, app.getPreferredSystemLanguages(), name)))
}
