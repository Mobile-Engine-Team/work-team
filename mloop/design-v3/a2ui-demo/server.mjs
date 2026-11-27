import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { catalog, catalogId, parseMessages } from './protocol.mjs';
import { applyMessages } from './public/state.js';
const port = Number(process.env.PORT || 3210);
const base = (process.env.OPENAI_BASE_URL || 'http://127.0.0.1:8766/v1').replace(/\/$/, '');
const model = process.env.OPENAI_MODEL || 'auto';
const headers = { 'Content-Type': 'application/json', ...(process.env.OPENAI_API_KEY ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {}) };
const prompt = `你是 A2UI 1.0 页面设计智能体。根据用户自然语言生成可交互的中文界面。只输出 JSON 消息数组，不要 Markdown 或说明。\n
协议：每个消息必须包含 version:"1.0"，以及且仅一个 createSurface/updateComponents/updateDataModel/deleteSurface。
createSurface:{surfaceId,catalogId:"${catalogId}",sendDataModel:true,components:[...],dataModel:{...}}。
updateComponents:{surfaceId,components:[...]}；updateDataModel:{surfaceId,path:"/xxx",value:...}；deleteSurface:{surfaceId}。
已有 surface 必须更新，不能重复创建。第一次生成请用 createSurface 内联完整 components 和 dataModel。root 组件 ID 必须为 root。组件是扁平邻接表，component 是字符串，child/children 使用 ID 引用。每个 child 必须存在，不允许循环。最多 100 个组件，尽量简洁。
数据绑定只用 {"@path":"/form/name"}，不能使用 {path:...}。Text 没有 h1/h2 或 heading variant，只有 body/caption。用简洁分组、Card 和 Row 展现信息，标题采用 body 文本，样式由前端负责，不生成 theme、HTML、CSS、JS 或额外属性。
可编辑控件 value 必须绑定 @path，并在 dataModel 初始化对应值。ChoicePicker.value 是字符串数组。Button.child 必须指向 Text 或 Row；action:{event:{name:"submit",userMessage:"提交表单",context:{name:{"@path":"/form/name"}}}}。
点击按钮的 action 与当前页面状态会作为用户输入。你要按事件更新界面，例如显示确认结果、添加/删除待办、筛选或切换页面；这是 demo，不能声称真的发送邮件、完成支付或预订。展示虚构数据时请在页面标注示例数据。
组件 JSON Schema：${JSON.stringify(catalog.components)}
允许的函数 JSON Schema：${JSON.stringify(catalog.functions)}
容器支持 children:{path:"/items",componentId:"item_template"}；模板内 @path 可使用相对路径如 title，或绝对路径 /form/name。校验使用 @checks:[{condition:{"@call":"required",args:{value:{"@path":"/form/name"}}},message:"请输入姓名"}]。
事件可用 context 携带绑定数据。禁止 functionCall 动作，不使用 RPC，不使用 @index。`;
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
async function body(req) {
  let text = ''; for await (const part of req) { text += part; if (Buffer.byteLength(text) > 1_500_000) throw new Error('请求过大'); }
  return JSON.parse(text);
}
async function completion(messages, signal) {
  const response = await fetch(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ model, messages, stream: false, temperature: 0.3, max_tokens: 10000 }), signal });
  if (!response.ok) throw new Error(`模型接口 ${response.status}：${(await response.text()).slice(0, 350)}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('模型没有返回文本内容');
  if (data.choices[0].finish_reason === 'length') throw new Error('模型输出被截断，请简化页面需求');
  return content;
}
const server = http.createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path === '/api/config' && req.method === 'GET') return json(res, 200, { base, model, version: '1.0', catalogId, components: Object.keys(catalog.components) });
    if (path === '/api/health' && req.method === 'GET') {
      const response = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`模型接口 HTTP ${response.status}`);
      return json(res, 200, await response.json());
    }
    if (path === '/api/generate' && req.method === 'POST') {
      const input = await body(req);
      if (!input.prompt || typeof input.prompt !== 'string' || input.prompt.length > 12000) return json(res, 400, { error: '请输入 1–12000 字的页面需求' });
      const state = input.surfaces || {};
      const history = (Array.isArray(input.history) ? input.history : []).slice(-8).filter(m => ['user', 'assistant'].includes(m.role) && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 35000) }));
      const messages = [{ role: 'system', content: prompt }, ...history, { role: 'user', content: `当前渲染器状态（包含用户已编辑的数据）：${JSON.stringify(state)}\n\n用户需求或事件：${input.prompt}` }];
      const controller = new AbortController();
      res.on('close', () => { if (!res.writableEnded) controller.abort(); });
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(150000)]);
      let raw, result, repaired = false;
      const started = Date.now();
      for (let attempt = 0; attempt < 2; attempt++) {
        raw = await completion(messages, signal);
        try { result = parseMessages(raw); applyMessages(state, result); break; }
        catch (error) {
          if (attempt) throw new Error(`自动修正后仍未通过校验：${error.message}`);
          repaired = true;
          messages.push({ role: 'assistant', content: raw }, { role: 'user', content: `你的输出未通过校验：${error.message}。请修正并重新输出完整 JSON 消息数组。` });
        }
      }
      return json(res, 200, { messages: result, elapsed: Date.now() - started, repaired });
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/state.js': ['state.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    if (!files[path]) return json(res, 404, { error: 'Not found' });
    const [file, type] = files[path];
    res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'" });
    res.end(await readFile(new URL(`./public/${file}`, import.meta.url)));
  } catch (error) {
    if (!res.destroyed) json(res, 502, { error: error.name === 'TimeoutError' ? '模型响应超时，请重试或缩小需求' : error.message });
  }
});
server.listen(port, '127.0.0.1', () => console.log(`A2UI 1.0 demo → http://127.0.0.1:${port}\nModel → ${base} (${model})`));
