import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Vite has already resolved symlinks. Each node_modules segment therefore names
// the version whose JS, CSS, font or worker actually enters the client artifact.
export function rendererNotices(ids, assets) {
  const roots = new Set()
  for (const id of ids) {
    const match = id.match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)/)
    if (match && existsSync(join(match[1], 'package.json'))) roots.add(match[1])
  }
  const notices = new Map()
  for (const root of roots) {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const name = manifest.name + '@' + manifest.version
    if (notices.has(name)) continue
    const names = readdirSync(root, { withFileTypes: true }).filter(entry =>
      entry.isFile() && /^(?:licen[cs]e|copying|notice|ofl)(?:[.-]|$)/i.test(entry.name))
    const contents = names.sort((a,b) => a.name.localeCompare(b.name)).map(entry =>
      entry.name + '\n' + readFileSync(join(root, entry.name), 'utf8'))
    notices.set(name, contents.join('\n') || 'Package license: ' + JSON.stringify(manifest.license ?? manifest.licenses ?? 'see package metadata'))
  }
  return [
    ...['LICENSE.upstream', 'LICENSE.multica', 'NOTICE.multica'].map(file => file + '\n' + readFileSync(join(assets, file), 'utf8')),
    ...[...notices].sort(([a], [b]) => a.localeCompare(b)).map(([name, text]) => name + '\n' + text),
  ].join('\n\n')
}
