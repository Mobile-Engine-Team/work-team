import { rendererNotices } from './renderer-notices.mjs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.env.WORKBENCH_V2_SRC || resolve(root, '../../.local/demo-v2/src/mobile-work-client'))
const revision = 'dbf36f4d2a9b69779c18cb5fec22ce3ee6302a69'
if (execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) {
  throw new Error('Renderer build requires the frozen V2 client at ' + revision)
}
execFileSync('git', ['-C', source, 'diff', '--quiet', 'HEAD', '--', 'apps/app/src', 'packages/multica-core'])
const app = resolve(source, 'apps/app')
const frozenRequire = createRequire(resolve(app, 'package.json'))
const { build } = await import(frozenRequire.resolve('vite'))
const { default: tailwindcss } = await import(frozenRequire.resolve('@tailwindcss/vite'))
const shell = '@team-workbench/ui-workspace-shell/client'
const shellDir = resolve(root, 'packages/ui-workspace-shell')
const shared = new Set(['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'])

// Resolve the shared foundations and offline dependencies against the same lock
// as the reference client. Only the DSH plugins under packages/ are entry points.
function sources(pagePlugin) {
  return {
    name: 'workbench-renderer-sources',
    enforce: 'pre',
    async resolveId(id, importer) {
      if (pagePlugin && (
        ['@tanstack/react-query', 'react-router-dom', '@multica/core/api'].includes(id)
        || (id.startsWith('.') && importer && resolve(dirname(importer), id) === resolve(source, 'packages/multica-core/api'))
        || (importer && /(?:^|\/)(?:client|ui)$/.test(id) && id.startsWith('.') &&
          [resolve(shellDir, 'views/team/client'), resolve(shellDir, 'views/team/ui')].includes(resolve(dirname(importer), id)))
      )) return { id: shell, external: true }
      if (id.startsWith('@team-workbench/')) return null
      if (id.startsWith('@/')) return this.resolve(resolve(app, 'src', id.slice(2)), importer, { skipSelf: true })
      if (!importer || !importer.startsWith(root + '/') || id.startsWith('.') || id.startsWith('/') || id.startsWith('\0') || shared.has(id)) return null
      return this.resolve(id, resolve(app, 'src/main.tsx'), { skipSelf: true })
    },
    transform(code, id) {
      if (id.endsWith('/multica-core/api/client.ts')) {
        const before = 'await fetch(`${this.baseUrl}/api/upload-file`,'
        if (!code.includes(before)) throw new Error('Frozen upload transport no longer matches the pinned revision')
        return code.replace(before, 'await (this.options.fetchTransport ?? fetch)(`${this.baseUrl}/api/upload-file`,')
      }
    },
  }
}

for (const name of (await readdir(resolve(root, 'packages'))).filter(name => name.startsWith('ui-'))) {
  const dir = resolve(root, 'packages', name)
  const pagePlugin = name !== 'ui-workspace-shell'
  const modules = new Set()
  const recordModules = () => ({
    name: 'workbench-package-notices',
    moduleParsed(module) { modules.add(module.id) },
  })
  const config = {
    root: app, configFile: false, envFile: false, publicDir: false, logLevel: 'warn',
    plugins: [sources(pagePlugin), recordModules(), ...(!pagePlugin ? [tailwindcss()] : [])],
    esbuild: { jsx: 'automatic' },
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.env.VITE_MOBILEWORK_PRODUCT_NAME': '"MobileWork"',
      'import.meta.env.VITE_MOBILEWORK_PRODUCT_VERSION': '"MW-V1.0.1"',
      'import.meta.env.VITE_MW_DEMO_PASSWORD_AUTH': '"1"',
    },
    worker: { format: 'es', plugins: () => [sources(false), recordModules()], rollupOptions: { output: { inlineDynamicImports: true } } },
    build: {
      write: false, target: 'es2022', minify: 'esbuild', assetsInlineLimit: () => true,
      // Let the DSH loader inject its own React singletons.
      lib: { entry: resolve(dir, 'client.jsx'), formats: ['cjs'], fileName: 'client' },
      rollupOptions: {
        external: id => shared.has(id) || (pagePlugin && id === shell),
        output: { exports: 'named', inlineDynamicImports: true },
        onwarn(warning, warn) {
          if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning)
        },
      },
    },
  }
  const outputs = await build(config)
  const chunk = outputs[0].output.find(file => file.type === 'chunk' && file.isEntry)
  await mkdir(resolve(dir, 'dist'), { recursive: true })
  await writeFile(resolve(dir, 'dist/client.js'), `window.__ModuleLoader__.load({
  id: ${JSON.stringify('@team-workbench/' + name)},
  factory(require) {
    const exports = {};
    ${chunk.code}
    return exports;
  }
})\n`)
  await writeFile(resolve(dir, 'dist/THIRD-PARTY-NOTICES.txt'), rendererNotices(modules, resolve(shellDir, 'assets')))
  console.log('Built ' + name)
}
