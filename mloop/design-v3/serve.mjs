import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath, stat} from 'node:fs/promises';
import {extname, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await realpath(fileURLToPath(new URL('.',import.meta.url)));
const port=Number(process.argv[2]||8086);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('请指定 1–65535 的本地端口');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon','.md':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return}
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=await realpath(resolve(root,'.'+(path==='/'?'/index.html':path)));
  if(!file.startsWith(root+sep)||file.slice(root.length+1).split(sep).some(p=>p.startsWith('.'))||!(await stat(file)).isFile()){res.writeHead(404).end('Not found');return}
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache'});
  if(req.method==='HEAD'){res.end();return}
  createReadStream(file).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404).end('Not found')}
});
server.on('error',error=>{console.error(`本地预览启动失败：${error.message}。可指定其他端口，例如 node serve.mjs 8087。`);process.exitCode=1});
server.listen(port,'127.0.0.1',()=>console.log(`MobileWork 本地预览：http://127.0.0.1:${port}/`));
