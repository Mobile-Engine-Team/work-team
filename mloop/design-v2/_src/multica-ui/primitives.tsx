import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown,ChevronLeft,ChevronRight,Search,X,MoreHorizontal,Calendar as CalendarIcon} from '../multica-icons';
const modalStack:HTMLElement[]=[];
export function registerModal(element:HTMLElement|null){if(!element)return()=>{};modalStack.push(element);const overlay=element.closest<HTMLElement>('.mc-overlay');if(overlay)overlay.style.zIndex=String(200+modalStack.length*5);return()=>{const index=modalStack.indexOf(element);if(index>=0)modalStack.splice(index,1)}}
export function isTopModal(element:HTMLElement|null){return modalStack[modalStack.length-1]===element}
export const cn=(...parts:any[])=>parts.filter(Boolean).join(' ');
export function Button({children,onClick,primary=false,...rest}:any){return <button type="button" className={cn('mc-button',primary&&'mc-primary')} onClick={onClick} {...rest}>{children}</button>}
export function IconButton({icon:Icon,label,onClick,active=false,children,...rest}:any){return <button type="button" className={cn('mc-icon-button',active&&'is-active')} title={label} aria-label={label} onClick={onClick} {...rest}><Icon size={16}/>{children}</button>}
export function Avatar({small=false,online=false,name='Mika',emoji,src}:any){const photo=src||(name==='Mika'?'expert-img/img-12.png':'');return <span className={cn('mc-avatar',small&&'mc-avatar-small',photo&&'mc-avatar-photo')} title={name}>{photo?<img src={photo} alt=""/>:<span>{emoji||name.slice(0,1).toUpperCase()}</span>}{online&&<i/>}</span>}

export function Popup({anchor,onClose,children,width=224,label,role='dialog'}:any){
  const ref=useRef<HTMLDivElement>(null);
  const [position,setPosition]=useState({left:0,top:0,maxHeight:360});
  useLayoutEffect(()=>{
    const place=()=>{const box=anchor.current?.getBoundingClientRect();const popup=ref.current;if(!box||!popup)return;const height=Math.min(popup.scrollHeight,360);const below=innerHeight-box.bottom-12;const top=below>=height?box.bottom+5:Math.max(8,box.top-height-5);setPosition({left:Math.max(8,Math.min(box.left,innerWidth-width-8)),top,maxHeight:Math.max(100,Math.min(360,innerHeight-top-8))})};
    place();const observer=new ResizeObserver(place);if(ref.current)observer.observe(ref.current);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)};
  },[width]);
  useEffect(()=>{
    const close=(e:any)=>{if(e.type==='keydown'){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onClose();anchor.current?.focus()}}else if(!ref.current?.contains(e.target)&&!anchor.current?.contains(e.target))onClose()};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',close,true);
    return()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',close,true)};
  },[onClose]);
  return createPortal(<div className="mc-font mc-popup" data-mc-popup role={role} aria-label={label} ref={ref} style={{...position,width}}>{children}</div>,document.body);
}

export function Select({label,value,onChange,options,className='',searchable=true,multiple=false,children,placeholder,triggerClassName,disabled=false}:any){
  const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[active,setActive]=useState(0);
  const trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null),list=useRef<HTMLDivElement>(null);const id=useId();
  const entries=options.map((o:any)=>typeof o==='string'?{value:o,label:o}:Array.isArray(o)?{value:o[0],label:o[1]}:o);
  const filtered=entries.filter((o:any)=>o.empty||!query.trim()||(String(o.label)+' '+(o.description||'')).toLowerCase().includes(query.trim().toLowerCase()));
  const selected=(v:any)=>multiple?(value||[]).includes(v):v===value;
  const close=()=>{setOpen(false);setQuery('')};
  const pick=(o:any)=>{if(o.disabled)return;onChange(multiple?(selected(o.value)?value.filter((v:any)=>v!==o.value):[...value,o.value]):o.value);if(!multiple){close();trigger.current?.focus()}};
  const move=(step:number)=>setActive(current=>{let next=current;for(let n=0;n<filtered.length;n++){next=(next+step+filtered.length)%filtered.length;if(!filtered[next]?.disabled)return next}return current});
  useEffect(()=>{if(open){search.current?.focus();setActive(Math.max(0,filtered.findIndex((o:any)=>selected(o.value))))}},[open]);
  useEffect(()=>{list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({block:'nearest'})},[active]);
  const selectedLabel=entries.find((o:any)=>selected(o.value))?.label||placeholder||value;
  const handleKeys=(e:any)=>{if(e.nativeEvent.isComposing||e.keyCode===229)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!open)setOpen(true);else move(e.key==='ArrowDown'?1:-1)}else if(e.key==='Enter'&&open){e.preventDefault();if(filtered[active])pick(filtered[active])}else if(e.key==='Home'&&open){e.preventDefault();setActive(0)}else if(e.key==='End'&&open){e.preventDefault();setActive(filtered.length-1)}else if(e.key==='Tab'&&open){close()}};
  return <span className={'mc-select '+className}><button ref={trigger} type="button" className={cn('mc-select-trigger',triggerClassName)} role="combobox" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={open?id:undefined} disabled={disabled} onClick={()=>setOpen(!open)} onKeyDown={handleKeys}>{children||<><span>{multiple?placeholder||label:selectedLabel}</span><ChevronDown size={12}/></>}</button>{open&&<Popup anchor={trigger} onClose={close} label={label+'选项'} role="presentation"><div onKeyDown={handleKeys}>{searchable&&<div className="mc-picker-search"><Search size={14}/><input ref={search} value={query} aria-label={'搜索'+label} placeholder={'搜索'+label+'…'} role="searchbox" aria-controls={id} aria-activedescendant={filtered[active]?id+'-'+active:undefined} onChange={e=>{const q=e.target.value;setQuery(q);const found=entries.filter((o:any)=>!o.disabled&&!o.empty&&String(o.label).toLowerCase().includes(q.trim().toLowerCase()));const first=found[0];setActive(Math.max(0,entries.filter((o:any)=>o.empty||!q.trim()||(String(o.label)+' '+(o.description||'')).toLowerCase().includes(q.trim().toLowerCase())).indexOf(first)))}}/></div>}<div className="mc-picker-options" role="listbox" id={id} aria-label={label} aria-multiselectable={multiple||undefined} ref={list}>{filtered.length?filtered.map((o:any,i:number)=><React.Fragment key={o.value}>{o.group&&filtered[i-1]?.group!==o.group&&<div className="mc-picker-group">{o.group}</div>}<button type="button" role="option" aria-selected={selected(o.value)} id={id+'-'+i} disabled={o.disabled} data-active={active===i} className="mc-picker-option" onPointerMove={()=>setActive(i)} onClick={()=>pick(o)}>{o.icon&&<o.icon size={16}/>}<span>{o.label}{o.description&&<small>{o.description}</small>}</span><Check size={14} style={{visibility:selected(o.value)?'visible':'hidden'}}/></button></React.Fragment>):<div className="mc-picker-empty">没有匹配结果</div>}</div></div></Popup>}</span>
}

export function Menu({icon:Icon=MoreHorizontal,label,children}:any){
  const [open,setOpen]=useState(false);const ref=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const keys=(e:any)=>{if(e.nativeEvent.isComposing)return;const options=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')||[]);const index=options.indexOf(document.activeElement as HTMLButtonElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowDown'?1:-1)+options.length)%options.length;options[next]?.focus()}else if(e.key==='Tab')setOpen(false)};
  useEffect(()=>{if(open)panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()},[open]);
  return <span className="mc-menu-wrap"><button ref={ref} type="button" title={label} aria-label={label} aria-haspopup="menu" aria-expanded={open} className={cn('mc-icon-button',open&&'is-active')} onClick={()=>setOpen(!open)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true)}}}><Icon size={16}/></button>{open&&<Popup label={label} role="menu" anchor={ref} onClose={()=>setOpen(false)}><div className="mc-menu-content" ref={panel} onKeyDown={keys} onClick={e=>{if((e.target as HTMLElement).closest('[role="menuitem"]')){setOpen(false);ref.current?.focus()}}}>{children}</div></Popup>}</span>
}
export function MenuItem({children,onClick,icon:Icon=Check,selected=false,danger=false,...rest}:any){return <button type="button" role="menuitem" className={danger?'mc-danger':''} onClick={onClick} {...rest}><Icon size={14} style={!selected&&Icon===Check?{visibility:'hidden'}:undefined}/>{children}</button>}

export function Modal({title,onClose,children,footer,className='',initialFocus=true}:any){
  const ref=useRef<HTMLDivElement>(null);const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement;const unregister=registerModal(ref.current);
    if(initialFocus)(ref.current?.querySelector<HTMLElement>('input,textarea,[contenteditable="true"]')||ref.current?.querySelector<HTMLElement>('footer button,button'))?.focus();
    const key=(e:KeyboardEvent)=>{if(!isTopModal(ref.current)||document.querySelector('[data-mc-popup]'))return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close.current()}if(e.key==='Tab'){const focusable=Array.from(ref.current?.querySelectorAll<HTMLElement>('button,input,textarea,[contenteditable="true"],[tabindex="0"],a[href]')||[]).filter(x=>x.offsetParent!==null&&!x.hasAttribute('disabled'));const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};
    document.addEventListener('keydown',key);return()=>{unregister();document.removeEventListener('keydown',key);if(prior?.isConnected)prior.focus()};
  },[]);
  return createPortal(<div className="mc-overlay mc-font" onMouseDown={e=>{if(e.target===e.currentTarget&&!document.querySelector('[data-mc-popup]'))onClose()}}><section ref={ref} className={cn('mc-form-dialog',className)} role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><IconButton icon={X} label="关闭" onClick={onClose}/></header><div className="mc-form-dialog-body">{children}</div>{footer&&<footer>{footer}</footer>}</section></div>,document.body);
}
export function Confirm({title,description,onClose,onConfirm}:any){return <Modal title={title} onClose={onClose} className="mc-confirm-dialog" footer={<><Button onClick={onClose}>取消</Button><Button onClick={onConfirm} className="mc-button mc-destructive">删除</Button></>}><p>{description}</p></Modal>}

export function DatePicker({label,value,onChange,placeholder}:any){
  const [open,setOpen]=useState(false),[month,setMonth]=useState(()=>new Date(value?value+'T12:00:00':'2026-11-09T12:00:00')),[text,setText]=useState(value||''),[error,setError]=useState('');const ref=useRef<HTMLButtonElement>(null);
  const y=month.getFullYear(),m=month.getMonth();const offset=(new Date(y,m,1).getDay()+6)%7;const days=new Date(y,m+1,0).getDate();const iso=(day:number)=>`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const pick=(date:string)=>{onChange(date);setText(date);setError('');setOpen(false);ref.current?.focus()};
  return <span className="mc-date-picker"><button className="mc-date-trigger" type="button" ref={ref} aria-label={label} aria-expanded={open} onClick={()=>{setText(value||'');setError('');setMonth(new Date((value||new Date().toLocaleDateString('en-CA'))+'T12:00:00'));setOpen(!open)}}><CalendarIcon size={13}/>{value||placeholder||label}</button>{open&&<Popup anchor={ref} onClose={()=>setOpen(false)} width={272} label={label+'选择'}><div className="mc-calendar"><input autoFocus aria-label={'输入'+label} placeholder="YYYY-MM-DD" value={text} onChange={e=>{setText(e.target.value);setError('')}} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();e.stopPropagation();if(/^\d{4}-\d{2}-\d{2}$/.test(text)&&!isNaN(Date.parse(text))&&new Date(text).toISOString().slice(0,10)===text)pick(text);else setError('请输入有效日期 YYYY-MM-DD')}}}/>{error&&<p role="alert" className="mc-form-error">{error}</p>}<header><IconButton icon={ChevronLeft} label="上个月" onClick={()=>setMonth(new Date(y,m-1,1))}/><strong>{y}年 {m+1}月</strong><IconButton icon={ChevronRight} label="下个月" onClick={()=>setMonth(new Date(y,m+1,1))}/></header><div className="mc-calendar-grid">{['一','二','三','四','五','六','日'].map(x=><small key={x}>{x}</small>)}{Array.from({length:offset},(_,i)=><span key={'empty'+i}/>)}{Array.from({length:days},(_,i)=><button key={i} className={value===iso(i+1)?'mc-calendar-selected':''} aria-label={iso(i+1)} onClick={()=>pick(iso(i+1))}>{i+1}</button>)}</div><footer><Button onClick={()=>pick(new Date().toLocaleDateString('en-CA'))}>今天</Button><Button onClick={()=>pick('')}>清除日期</Button></footer></div></Popup>}</span>
}
