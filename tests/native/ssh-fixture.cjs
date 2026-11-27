// Loopback SSH protocol peer for testing native trust decisions without an external host.
const { generateKeyPairSync, randomUUID } = require('node:crypto')
const { createRequire } = require('node:module')
const { join } = require('node:path')
const { Server } = createRequire(join(process.argv[2], 'packages/execution-bridge/package.json'))('ssh2')
const privateKey = generateKeyPairSync('rsa', {modulusLength:2048}).privateKey.export({type:'pkcs1',format:'pem'})
const port = Number(process.argv[3])
const user = process.argv[4]
const fixture = new Server({hostKeys:[privateKey]}, client => {
  client.on('error',() => {})
  client.on('authentication', auth => {
    if (auth.method === 'password' && auth.username === 'workbench' && auth.password === 'local-fixture') auth.accept()
    else auth.reject(['password'])
  }).on('ready',() => client.on('session',accept => {
    accept().on('exec',(approve,reject,info) => {
      if (info.command !== 'multica daemon connect') return reject()
      const stream = approve()
      let request = ''
      stream.on('data',chunk => {
        request += chunk
        if (request.length > 65536) client.end()
      }).on('end',async () => {
        try {
          const config = JSON.parse(request)
          if (config.server_url !== 'http://127.0.0.1:19115') throw Error()
          const body = await (await fetch(config.server_url+'/api/me',{
            headers:{authorization:'Bearer '+config.token},redirect:'error',signal:AbortSignal.timeout(4000),
          })).json()
          if (body.id !== config.user_id || body.name !== user) throw Error()
          stream.write(JSON.stringify({ok:true,state:'running',daemonId:randomUUID()}))
          stream.exit(0)
        } catch { stream.exit(1) }
        stream.end()
      })
    })
  }))
})
fixture.listen(port, '127.0.0.1', () => console.log(fixture.address().port))
