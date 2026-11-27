import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
const load = name => JSON.parse(readFileSync(new URL(`./schemas/${name}.json`, import.meta.url)));
export const catalog = load('catalog');
export const catalogId = catalog.catalogId;
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(load('common_types')).addSchema(catalog);
const check = ajv.compile(load('agent_to_renderer'));
export function parseMessages(raw) {
  const text = raw.trim().replace(/^```(?:json|jsonl)?\s*/i, '').replace(/\s*```$/, '');
  let result;
  try { result = JSON.parse(text); }
  catch { result = text.split('\n').filter(x => x.trim()).map(x => JSON.parse(x)); }
  const messages = Array.isArray(result) ? result : [result];
  if (!messages.length || messages.length > 40) throw new Error('必须返回 1–40 条 A2UI 消息');
  for (const message of messages) {
    if (!check(message)) {
      const errors = check.errors.filter(e => !['const', 'oneOf'].includes(e.keyword));
      throw new Error(`A2UI 1.0 Schema 校验失败：${JSON.stringify(errors.slice(0, 8))}`);
    }
    const key = Object.keys(message).find(k => k !== 'version');
    if (!['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface'].includes(key)) throw new Error(`此 demo 未注册 RPC：${key}`);
    walk(message, obj => {
      if (obj.catalogId && obj.catalogId !== catalogId || obj['@catalogId'] && obj['@catalogId'] !== catalogId) throw new Error('不支持的 catalogId');
      if (obj['@call'] && !catalog.functions[obj['@call']]) throw new Error(`不支持的函数：${obj['@call']}`);
    });
  }
  return messages;
}
function walk(value, fn) {
  if (!value || typeof value !== 'object') return;
  fn(value);
  for (const value2 of Object.values(value)) walk(value2, fn);
}
