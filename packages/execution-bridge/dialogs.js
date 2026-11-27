import { readFile } from 'node:fs/promises'
import { request } from 'node:http'
import { join } from 'node:path'

export async function nativeDialog(type, args = {}) {
  let socketPath
  try { socketPath = await readFile(join(process.env.WORKBENCH_STATE, 'desktop/dialog-socket'), 'utf8') }
  catch { throw new Error('请从本机应用打开此操作。') }
  const body = JSON.stringify({type, ...args})
  return new Promise((resolve,reject) => {
    const req = request({method:'POST', socketPath, path:'/dialog', headers:{
      'content-type':'application/json','content-length':Buffer.byteLength(body),
    }}, res => {
      let value = ''
      res.setEncoding('utf8')
      res.on('data',chunk => { value += chunk })
      res.on('end',() => {
        try {
          if (res.statusCode !== 200) throw Error('系统对话框无法打开。')
          resolve(JSON.parse(value))
        } catch (error) { reject(error) }
      })
    })
    req.once('error',() => reject(Error('请从本机应用打开此操作。')))
    req.end(body)
  })
}
