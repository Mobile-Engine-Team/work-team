import { join } from 'node:path'
import { stopOwnedDaemons } from './daemon.js'

try {
  await stopOwnedDaemons(join(process.env.WORKBENCH_STATE, 'daemons'))
} catch (error) {
  console.error(error.status ? error.message : '无法核对本产品执行端身份。')
  process.exitCode = 1
}
