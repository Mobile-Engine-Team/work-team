// Type-check the migrated views with the frozen SDK's package exports and types.
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(process.env.WORKBENCH_V2_SRC || resolve(root, '../../.local/demo-v2/src/mobile-work-client'))
const app = resolve(source, 'apps/app')
const shell = resolve(root, 'packages/ui-workspace-shell')
const fromApp = createRequire(resolve(app, 'package.json'))
const options = {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX, strict: true, noEmit: true, skipLibCheck: true, allowJs: true,
  baseUrl: app, paths: { '@/*': ['./src/*'], '@team-workbench/ui-workspace-shell/client': [resolve(shell, 'client.jsx')] },
  types: [], resolveJsonModule: true, lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
}
const cache = ts.createModuleResolutionCache(root, file => file, options)
const host = ts.createCompilerHost(options)
host.resolveModuleNames = (names, file) => names.map(name => {
  // Resolve package imports in product code from the same package graph as the
  // bundler. For workspace modules, prefer the product's own published exports.
  const local = name.startsWith('.') || name.startsWith('@team-workbench/') || !file.startsWith(root + '/')
  const origin = local ? file : resolve(app, 'src/main.tsx')
  return ts.resolveModuleName(name, origin, options, host, cache).resolvedModule
})
const entries = [resolve(app, 'globals.d.ts'), fromApp.resolve('@types/node/package.json').replace(/package\.json$/, 'index.d.ts'), resolve(dirname(fromApp.resolve('vite/package.json')), 'client.d.ts'),
  ...['workspace-shell','inbox','members','squads','tasks'].map(n=>resolve(root, 'packages/ui-' + n + '/client.jsx'))]
const program = ts.createProgram(entries, options, host)
const diagnostics = ts.getPreEmitDiagnostics(program)
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name, getCurrentDirectory: () => root, getNewLine: () => '\n',
  }))
  process.exitCode = 1
}
