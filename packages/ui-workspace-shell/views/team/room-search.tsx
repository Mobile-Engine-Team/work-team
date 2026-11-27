import {useEffect,useRef,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import { ArrowUpRight, Search, X } from "../icons";
import {z} from "zod";
import {request} from "../workbench/api";
import {Failure} from "./ui";
import {SidePanel} from "./work-tools";

const results=z.array(z.object({id:z.string(),title:z.string(),kind:z.enum(["message","issue"])}));
export function RoomSearch({ws,id,close,openIssue}:{ws:string;id:string;close:()=>void;openIssue:(issue:string)=>void}){
  const [query,setQuery]=useState(""),[kind,setKind]=useState("全部"),[smart,setSmart]=useState(false),[active,setActive]=useState(0);
  const [seed,setSeed]=useState("");
  const list=useRef<HTMLDivElement>(null);
  const lookup=useQuery({queryKey:["team",ws,"room-search",id,query.trim()],enabled:!smart&&!!query.trim(),retry:false,
    queryFn:()=>request(ws,"/rooms/"+id+"/search?q="+encodeURIComponent(query.trim()),results)});
  const found=(lookup.data||[]).filter(r=>kind==="全部" || (r.kind==="message" ? "聊天记录" : "任务")===kind);
  const selected=Math.min(active,Math.max(0,found.length-1));
  function choose(index:number){
    const row=found[index];if(!row)return;
    if(row.kind==="issue")openIssue(row.id);
    else {const message=document.getElementById("msg-"+row.id);message?.scrollIntoView({block:"center"});message?.focus({preventScroll:true})}
    close();
  }
  useEffect(()=>{
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();close()}};
    window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);
  },[close]);
  return <aside className="room-search" role="dialog" aria-label="会话内搜索">
    <header><button aria-pressed={!smart} onClick={()=>setSmart(false)}>快搜</button><button aria-pressed={smart} onClick={()=>{setSeed(query.trim());setSmart(true)}}>智能</button>
      <button aria-label="关闭搜索" onClick={close}><X size={16}/></button></header>
    {smart?<SidePanel key={id} ws={ws} kind="room" id={id} close={close} firstPrompt={seed}/>:<>
      <label><Search size={16}/><input autoFocus type="search" maxLength={200} aria-label="搜索当前会话" placeholder="在此会话中搜索…" value={query} onChange={e=>{setQuery(e.target.value);setActive(0)}} onKeyDown={e=>{
        if(e.nativeEvent.isComposing || !found.length)return;
        if(e.key==="Enter"){e.preventDefault();choose(selected)}
        if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();const next=(selected+(e.key==="ArrowUp"?-1:1)+found.length)%found.length;setActive(next);list.current?.children[next]?.scrollIntoView({block:"nearest"})}
      }}/></label>
      <nav aria-label="搜索范围">{["全部","聊天记录","任务"].map(k=><button key={k} aria-pressed={k===kind} onClick={()=>{setKind(k);setActive(0)}}>{k}</button>)}</nav>
      <Failure error={lookup.error}/><div className="room-results" ref={list}>{found.map((r,i)=><button key={r.kind+r.id} aria-current={selected===i||undefined} onClick={()=>choose(i)}><span>{r.title}<small>{r.kind==="message"?"聊天记录":"任务"}</small></span><ArrowUpRight size={14}/></button>)}</div>
      {!found.length&&!lookup.error&&<div className="room-search-empty" role="status"><i><Search size={21}/></i><strong>{!query.trim()?"查找会话内容":lookup.isFetching?"正在搜索…":"没有找到匹配结果"}</strong>
        {!query.trim()&&<small>输入关键词查找消息与关联任务。</small>}</div>}

    </>}
  </aside>;
}
