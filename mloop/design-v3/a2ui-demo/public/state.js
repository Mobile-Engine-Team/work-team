export const CATALOG_ID = 'urn:a2ui-demo:catalog:1.0';
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export function pointer(path, scope = '') {
  if (typeof path !== 'string') throw new Error('数据路径必须是字符串');
  const full = path.startsWith('/') ? path : `${scope}/${path}`;
  const keys = full.split('/').slice(1).filter((v, i, arr) => v || i < arr.length - 1).map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (keys.some(k => forbidden.has(k))) throw new Error('禁止的数据路径');
  return keys;
}
export function read(model, path, scope = '') {
  if (path === '/' || path === '') return path === '/' ? model : pointer(scope).reduce((x, k) => x?.[k], model);
  return pointer(path, scope).reduce((x, k) => x?.[k], model);
}
export function write(model, path, value, scope = '', remove = false) {
  const keys = pointer(path, scope);
  if (!keys.length) return value;
  let node = model;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!node[k] || typeof node[k] !== 'object') node[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    node = node[k];
  }
  if (remove && value === null) delete node[keys.at(-1)];
  else node[keys.at(-1)] = value;
  return model;
}
export function resolve(value, model, scope = '') {
  if (Array.isArray(value)) return value.map(v => resolve(v, model, scope));
  if (!value || typeof value !== 'object') return value;
  if ('@path' in value) return read(model, value['@path'], scope);
  if ('@call' in value) {
    const a = resolve(value.args || {}, model, scope);
    const truth = v => typeof v === 'object' && v !== null && 'valid' in v ? v.valid : Boolean(v);
    switch (value['@call']) {
      case 'required': return { valid: a.value !== null && a.value !== undefined && a.value !== '' && (!Array.isArray(a.value) || a.value.length > 0) };
      case 'email': return { valid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(a.value ?? '')) };
      case 'length': return { valid: String(a.value ?? '').length >= (a.min ?? 0) && String(a.value ?? '').length <= (a.max ?? Infinity) };
      case 'numeric': return { valid: a.value !== '' && Number.isFinite(Number(a.value)) && Number(a.value) >= (a.min ?? -Infinity) && Number(a.value) <= (a.max ?? Infinity) };
      case 'and': return a.values.every(truth);
      case 'or': return a.values.some(truth);
      case 'not': return !truth(a.value);
      default: throw new Error(`不支持的函数 ${value['@call']}`);
    }
  }
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, model, scope)]));
}
export function applyMessages(current, messages) {
  const next = structuredClone(current);
  for (const m of messages) {
    if (m.version !== '1.0') throw new Error('只支持 A2UI 1.0');
    const key = Object.keys(m).find(k => k !== 'version'), p = m[key];
    if (!p?.surfaceId || forbidden.has(p.surfaceId)) throw new Error('非法 surfaceId');
    if (key === 'createSurface') {
      if (next[p.surfaceId]) throw new Error(`surface 已存在：${p.surfaceId}，应更新或先删除`);
      if (p.catalogId !== CATALOG_ID) throw new Error('未知组件目录');
      next[p.surfaceId] = { surfaceId: p.surfaceId, catalogId: p.catalogId, sendDataModel: Boolean(p.sendDataModel), components: {}, dataModel: p.dataModel || {} };
    } else if (!next[p.surfaceId]) throw new Error(`surface 不存在：${p.surfaceId}`);
    const s = next[p.surfaceId];
    if (key === 'deleteSurface') { delete next[p.surfaceId]; continue; }
    if (p.components) {
      const seen = new Set();
      for (const c of p.components) {
        if (forbidden.has(c.id) || seen.has(c.id)) throw new Error(`非法或重复组件 ID：${c.id}`);
        seen.add(c.id); s.components[c.id] = c;
      }
    }
    if (key === 'updateDataModel') {
      if ((!p.path || p.path === '/') && (!p.value || typeof p.value !== 'object' || Array.isArray(p.value))) throw new Error('根数据模型必须是对象');
      s.dataModel = write(s.dataModel, p.path || '/', p.value, '', true);
    }
  }
  for (const s of Object.values(next)) {
    if (!s.components.root) throw new Error('缺少 root 组件');
    const visit = (id, parents = new Set(), depth = 0) => {
      if (depth > 40 || parents.has(id)) throw new Error('组件循环引用或嵌套过深');
      const c = s.components[id]; if (!c) throw new Error(`组件引用不存在：${id}`);
      const children = [...(Array.isArray(c.children) ? c.children : c.children ? [c.children.componentId] : []), ...(c.child ? [c.child] : []), ...(c.tabs || []).map(t => t.child)];
      const chain = new Set(parents).add(id);
      children.forEach(child => visit(child, chain, depth + 1));
    };
    visit('root');
    if (Object.keys(s.components).length > 300) throw new Error('单页最多 300 个组件');
  }
  if (Object.keys(next).length > 8) throw new Error('最多 8 个 surface');
  return next;
}
