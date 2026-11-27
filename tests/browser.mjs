// The frozen V2 product journeys run against two real DSH Hosts and Multica.
// Keep bearer entries, generated passwords and failure diagnostics local.
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

const state = resolve('.local/v2-runtime')
const local = process.env.WORKBENCH_LOCAL_SCRIPT || resolve(state, 'desktop/Team Workbench.app/Contents/Resources/product/scripts/local')
const env = { ...process.env, WORKBENCH_RUNTIME: state, WORKBENCH_LOCAL_SCRIPT: local }
function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit', env })
}
if (existsSync(resolve(state, 'model.private.json'))) {
  throw new Error('请使用没有配置供应商凭据的合成验收现场。')
}
for (const profile of ['a', 'b']) run('/usr/bin/python3', [local, 'start', profile, '--fixture'])
const collaborationOnly = process.argv.includes('--collaboration-only')
const migration = ['tests/migration/replay.py', '--browser']
if (collaborationOnly) migration.push('--stages', 'accounts', 'workspace', 'invite', 'agents', 'tasks', 'identity')
if (env.WORKBENCH_JOURNEY_RESULTS) migration.push('--output', env.WORKBENCH_JOURNEY_RESULTS)
run('python3', migration)
if (!collaborationOnly) {
  const review = ['tests/review/run.py']
  if (env.WORKBENCH_REVIEW_RESULTS) review.push('--output', env.WORKBENCH_REVIEW_RESULTS)
  run('python3', review)
  run('python3', ['tests/review/assembly.py'])
}
