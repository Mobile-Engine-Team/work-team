import { applyMessages, resolve, write, read } from './state.js';
const $ = id => document.getElementById(id);
let surfaces = {}, history = [], wire = [], events = [], busy = false, controller, selectedTab = 'preview';
const tabState = new Map();
const empty = $('preview').innerHTML;
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = String(text ?? ''); return n; }
function bubble(text, type = 'assistant') { const n = el('div', `bubble ${type}`, text); $('chat').append(n); $('chat').scrollTop = $('chat').scrollHeight; return n; }
function error(message) { $('error').textContent = message; $('error').hidden = false; }
function setBusy(value) {
  busy = value; document.body.classList.toggle('busy', value);
  $('send').hidden = value; $('stop').hidden = !value;
  document.querySelectorAll('.examples button,#reset').forEach(b => b.disabled = value);
  render();
}
function inspect() {
  $('json').textContent = JSON.stringify(wire, null, 2);
  $('data-code').textContent = JSON.stringify(Object.fromEntries(Object.entries(surfaces).map(([id, s]) => [id, s.dataModel])), null, 2);
  $('event-code').textContent = events.length ? JSON.stringify(events, null, 2) : '暂无交互事件';
  const count = Object.values(surfaces).reduce((n, s) => n + Object.keys(s.components).length, 0);
  $('component-count').textContent = count ? `${Object.keys(surfaces).length} SURFACE · ${count} COMPONENTS` : '';
  $('canvas-status').textContent = count ? '界面已就绪，可直接交互' : '等待你的第一个想法';
}
function render() {
  const p = $('preview'); p.replaceChildren();
  if (!Object.keys(surfaces).length) p.innerHTML = empty;
  for (const s of Object.values(surfaces)) {
    const surface = el('section', 'surface'); surface.dataset.surfaceId = s.surfaceId;
    try { surface.append(component(s, 'root')); } catch (e) { surface.append(el('p', 'field-error', e.message)); }
    p.append(surface);
  }
  inspect();
}
function component(s, id, scope = '', depth = 0) {
  if (depth > 40) throw new Error('组件层级过深');
  const c = s.components[id]; if (!c) return el('span', 'field-error', `等待组件 ${id}`);
  const val = v => resolve(v, s.dataModel, scope);
  const child = childId => component(s, childId, scope, depth + 1);
  let n;
  function bind(control, field = 'value', convert = x => x) {
    if (!c[field]?.['@path']) return;
    let composing = false;
    control.addEventListener('compositionstart', () => { composing = true; });
    control.addEventListener('compositionend', () => { composing = false; control.dispatchEvent(new Event('input')); });
    control.addEventListener('input', () => {
      if (composing) return;
      const v = convert(control);
      s.dataModel = write(s.dataModel, c[field]['@path'], v, scope);
      // Preserve focus, selection, and input composition while updating dependent components.
      const active = document.activeElement;
      const key = active?.dataset.bindingKey, start = active?.selectionStart, end = active?.selectionEnd;
      render();
      const next = key && [...$('preview').querySelectorAll('[data-binding-key]')].find(e => e.dataset.bindingKey === key);
      if (next) { next.focus(); if (typeof start === 'number' && (['text','password','search','tel','url'].includes(next.type) || next.tagName === 'TEXTAREA')) { try { next.setSelectionRange(start, end); } catch {} } }
    });
    control.dataset.bindingKey = `${s.surfaceId}:${id}:${scope}`;
  }
  function label(control, text) {
    const container = el('label', 'ui-field'); container.append(el('span', '', text), control); return container;
  }
  const children = () => {
    if (Array.isArray(c.children)) return c.children.map(child);
    if (c.children) {
      const list = read(s.dataModel, c.children.path, scope);
      const path = c.children.path.startsWith('/') ? c.children.path : `${scope}/${c.children.path}`;
      return Array.isArray(list) ? list.slice(0, 100).map((_, i) => component(s, c.children.componentId, `${path}/${i}`, depth + 1)) : [];
    }
    return [];
  };
  switch (c.component) {
    case 'Column': case 'Row': case 'List': {
      n = el('div', c.component === 'Row' || c.direction === 'horizontal' ? 'ui-row' : 'ui-column');
      const css = { start:'flex-start',end:'flex-end',center:'center',stretch:'stretch',spaceBetween:'space-between',spaceAround:'space-around',spaceEvenly:'space-evenly' };
      if (c.align) n.style.alignItems = css[c.align]; if (c.justify) n.style.justifyContent = css[c.justify];
      n.append(...children()); break;
    }
    case 'Card': n = el('div','ui-card'); n.append(child(c.child)); break;
    case 'Text': n = el('p',`ui-text ${c.variant || ''}`, val(c.text)); break;
    case 'Divider': n = el('hr','ui-divider'); break;
    case 'TextField': {
      const input = el(c.variant === 'longText' ? 'textarea' : 'input');
      if (input.tagName === 'INPUT') input.type = c.variant === 'obscured' ? 'password' : c.variant === 'number' ? 'number' : 'text';
      input.value = val(c.value) ?? ''; input.placeholder = val(c.placeholder) ?? '';
      bind(input, 'value', x => x.value); n = label(input, val(c.label)); break;
    }
    case 'CheckBox': {
      n = el('label','ui-check'); const input = el('input'); input.type = 'checkbox'; input.checked = Boolean(val(c.value));
      bind(input,'value', x => x.checked); n.append(input,el('span','',val(c.label))); break;
    }
    case 'Slider': {
      const input = el('input'); input.type='range'; input.min=c.min ?? 0; input.max=c.max; input.value=val(c.value) ?? c.min ?? 0;
      if(c.steps) input.step=(c.max-(c.min || 0))/c.steps;
      bind(input,'value',x => Number(x.value)); n=label(input,`${val(c.label) || ''}  ${input.value}`); break;
    }
    case 'DateTimeInput': {
      const input=el('input');input.type=c.enableDate && c.enableTime?'datetime-local':c.enableTime?'time':'date';input.value=val(c.value) || '';
      if(c.min)input.min=val(c.min);if(c.max)input.max=val(c.max);bind(input,'value',x=>x.value);n=label(input,val(c.label)||'日期');break;
    }
    case 'ChoicePicker': {
      n=el('div','ui-field');if(c.label)n.append(el('span','',val(c.label)));
      const options=el('div',`ui-options ${c.displayStyle || ''}`);
      const selected=val(c.value)||[];
      for(const option of c.options){
        const l=el('label');const input=el('input');input.type=c.variant==='multipleSelection'?'checkbox':'radio';input.name=`${s.surfaceId}-${id}-${scope}`;input.checked=selected.includes(option.value);
        input.addEventListener('change',()=>{
          const next=c.variant==='multipleSelection'?(input.checked?[...selected,option.value]:selected.filter(v=>v!==option.value)):[option.value];
          if(c.value?.['@path'])s.dataModel=write(s.dataModel,c.value['@path'],next,scope);render();
        });l.append(input,el('span','',val(option.label)));options.append(l);
      }
      if(c.filterable){const filter=el('input');filter.placeholder='筛选选项';filter.setAttribute('aria-label','筛选选项');filter.addEventListener('input',()=>{for(const l of options.children)l.hidden=!l.textContent.includes(filter.value)});n.append(filter)}
      n.append(options);break;
    }
    case 'Button': {
      n=el('button',`ui-button ${c.variant||''}`);n.type='button';n.disabled=busy;n.append(child(c.child));
      n.addEventListener('click',async()=>{
        const failures=[];
        // Evaluate controls against their own scopes, then all button checks.
        for(const target of $('preview').querySelectorAll('[data-check-component]')){
          if(target.closest('[data-surface-id]')?.dataset.surfaceId !== s.surfaceId)continue;
          const ctrl=s.components[target.dataset.checkComponent];
          for(const check of ctrl['@checks']||[]){const result=resolve(check.condition,s.dataModel,target.dataset.checkScope||'');if(!(typeof result==='object'&&result!==null?'valid'in result?result.valid:Boolean(result):Boolean(result)))failures.push(check.message||'请检查输入内容')}
        }
        if(failures.length){error([...new Set(failures)].join('；'));return}
        const event=c.action?.event;if(!event){error('此 demo 只支持 action.event');return}
        const message={version:'1.0',action:{name:event.name,surfaceId:s.surfaceId,sourceComponentId:id,timestamp:new Date().toISOString(),context:val(event.context||{}),...(event.userMessage?{userMessage:val(event.userMessage)}:{})}};
        events.push(message);inspect();
        await generate(JSON.stringify({message,metadata:{a2uiRendererDataModel:{version:'1.0',surfaces:Object.fromEntries(Object.values(surfaces).filter(s=>s.sendDataModel).map(s=>[s.surfaceId,s.dataModel]))}}}), `触发操作：${val(event.userMessage)||event.name}`);
      });break;
    }
    case 'Image': {
      const url=String(val(c.url)||'');n=el('img',`ui-image ${c.variant||''}`);if(/^https:\/\//i.test(url)||url.startsWith('/'))n.src=url;
      n.alt=val(c.description)||'';n.loading='lazy';n.style.objectFit=c.fit||'cover';break;
    }
    case 'Icon': {
      const icons={check:'✓',add:'＋',close:'×',star:'☆',favorite:'♡',shoppingCart:'🛒',calendarToday:'▦',mail:'✉',person:'♙',search:'⌕',info:'ⓘ',home:'⌂',arrowForward:'→',arrowBack:'←',delete:'⌫',payment:'▣',locationOn:'⌖',send:'↗'};
      const name=val(c.name);
      if(name&&typeof name==='object'&&name.svgPath){n=document.createElementNS('http://www.w3.org/2000/svg','svg');n.setAttribute('viewBox','0 0 24 24');n.setAttribute('width','24');n.setAttribute('height','24');const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',String(val(name.svgPath)));p.setAttribute('fill','currentColor');n.append(p)}
      else n=el('span','ui-icon',icons[name]||'◇');break;
    }
    case 'Tabs': {
      n=el('div');const bar=el('div','ui-tabbar');bar.setAttribute('role','tablist');const key=`${s.surfaceId}:${id}:${scope}`;const index=Math.min(tabState.get(key)||0,c.tabs.length-1);
      c.tabs.forEach((t,i)=>{const b=el('button',i===index?'active':'',val(t.title));b.setAttribute('role','tab');b.setAttribute('aria-selected',String(i===index));b.onclick=()=>{tabState.set(key,i);render()};bar.append(b)});n.append(bar,child(c.tabs[index].child));break;
    }
    default: throw new Error(`未注册组件 ${c.component}`);
  }
  if(c.weight!==undefined)n.style.flexGrow=String(c.weight);
  if(c['@checks']){n.dataset.checkComponent=id;n.dataset.checkScope=scope}
  const a=c['@accessibility'];if(a){if(a.label)n.setAttribute('aria-label',String(val(a.label)));if(a.description)n.setAttribute('aria-description',String(val(a.description)));if(a.live)n.setAttribute('aria-live',a.live);if(a.hidden!==undefined)n.setAttribute('aria-hidden',String(Boolean(val(a.hidden))))}
  return n;
}
async function generate(prompt, display=prompt) {
  if(busy)return;
  $('error').hidden=true;bubble(display,'user');const pending=bubble('正在理解需求并构建 A2UI 页面…');
  setBusy(true);controller=new AbortController();
  try {
    const res=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,history,surfaces}),signal:controller.signal});
    const data=await res.json();if(!res.ok)throw new Error(data.error||`HTTP ${res.status}`);
    const next=applyMessages(surfaces,data.messages);
    surfaces=next;wire.push(...data.messages);
    history.push({role:'user',content:prompt},{role:'assistant',content:JSON.stringify(data.messages)});
    history=history.slice(-8);
    pending.textContent=`${data.messages.length} 条 A2UI 消息已渲染。你可以直接操作页面，也可以继续描述修改。${data.repaired?'（模型已自动修正格式）':''}`;
    $('metrics').textContent=`A2UI 1.0 · ${(data.elapsed/1000).toFixed(1)}s · Schema 已校验`;
    selectTab('preview');
  } catch(e) {
    const message=e.name==='AbortError'?'已停止生成，当前页面保留。':e.message;
    pending.textContent=message;pending.classList.add('error');if(e.name!=='AbortError')error(message);
  } finally {setBusy(false);$('chat').scrollTop=$('chat').scrollHeight;controller=undefined}
}
function selectTab(tab) {
  selectedTab=tab;
  for(const name of ['preview','json','data'])$(name).hidden=name!==tab;
  document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))});
  $('mobile').hidden=tab!=='preview';
}
$('composer').addEventListener('submit',e=>{e.preventDefault();const text=$('prompt').value.trim();if(!text||busy)return;$('prompt').value='';generate(text)});
$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){$('composer').requestSubmit()}});
document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>generate(b.dataset.prompt));
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
$('stop').onclick=()=>controller?.abort();
$('mobile').onclick=()=>{const active=$('preview').classList.toggle('mobile');$('mobile').setAttribute('aria-pressed',String(active))};
$('reset').onclick=()=>{if(busy)return;surfaces={};history=[];wire=[];events=[];tabState.clear();$('chat').replaceChildren();$('error').hidden=true;$('metrics').textContent='A2UI 1.0 · 自定义 Basic 子集';selectTab('preview');render();bubble('已新建。描述你想要的页面吧。')};
$('export').onclick=()=>{const initial=Object.values(surfaces).map(s=>({version:'1.0',createSurface:{surfaceId:s.surfaceId,catalogId:s.catalogId,sendDataModel:s.sendDataModel,components:Object.values(s.components),dataModel:s.dataModel}}));if(!initial.length){error('生成页面后即可导出');return}const url=URL.createObjectURL(new Blob([JSON.stringify(initial,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='a2ui-1.0-page.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
async function init(){try{const config=await(await fetch('/api/config')).json();$('model-info').textContent=`${config.model} · ${config.base.replace('http://','')}`;const r=await fetch('/api/health');if(!r.ok)throw new Error();$('connection').textContent='本地模型已连接'}catch{$('connection').textContent='模型未连接';$('connection').classList.add('off')}}
init();
