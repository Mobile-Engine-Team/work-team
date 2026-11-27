import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Bot, ChevronDown, ChevronRight,
  Folder, LayoutGrid, List, MessageSquare, MessagesSquare, Network, PanelsTopLeft, Users,
} from "lucide-react";
import { useTeam } from "../team/client";
import { Failure } from "../team/ui";
import { request } from "./api";

const itemSchema = z.object({
  id: z.string(), title: z.string(), kind: z.enum(["issue", "room", "agent", "work"]),
  project_id: z.string().nullable(), project_title: z.string().nullable(),
  related: z.boolean(), status: z.string(), unread: z.number(), tag: z.string(),
});
type Item = z.infer<typeof itemSchema>;

function statusIcon(status: string) {
  const done=status==="done", blocked=status==="blocked", progress=status==="in_progress" || status==="in_review";
  const color=done?"#3b6fd8":blocked?"#e5484d":progress?"#d9a441":"#71717a";
  return <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{color}}>
    <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" fill={done?"currentColor":"none"}/>
    {progress&&<path d="M7 7V3.5a3.5 3.5 0 0 1 0 7Z" fill="currentColor"/>}
    {done&&<path d="m3.4 7.8 2 2 5-5" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>}
    {blocked&&<path d="m4.5 4.5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
  </svg>;
}

export function WorkspaceNavigation({view,issueId,showTasks,show,pins}:{
  view:string; issueId?:string; showTasks:boolean; show:(entry:string)=>boolean;
  pins:{id:string;name:string}[];
}) {
  const {workspace,user}=useTeam();
  const [params]=useSearchParams();
  const navigate=useNavigate();
  const openPage=(route:Record<string,string>)=>navigate("/team/"+workspace.slug+"?"+new URLSearchParams(route));
  const [allRecent,setAllRecent]=useState(false),[allPins,setAllPins]=useState(false);
  const [closed,setClosed]=useState<Record<string,boolean>>({});
  const [more,setMore]=useState<Record<string,boolean>>({});
  const items=useQuery({queryKey:["team",workspace.id,"navigation",user.id],
    queryFn:()=>request(workspace.id,"/navigation",z.array(itemSchema)), refetchInterval:5000});
  const recent=(items.data||[]).filter(i=>i.kind!=="issue");
  const groups=new Map<string,Item[]>();
  for(const row of items.data||[]){
    if(!row.related) continue;
    const key=row.project_id||"";
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key)!.push(row);
  }
  function active(row:Item){
    if(row.kind==="issue") return issueId===row.id;
    return (row.kind==="room" && view==="rooms" && params.get("room")===row.id)
      || (row.kind==="work" && view==="workbench" && params.get("conversation")===row.id)
      || (row.kind==="agent" && view==="agent-chat" && params.get("chat")===row.id);
  }
  function open(row:Item){
    if(row.kind==="issue") navigate("/team/"+workspace.slug+"/issue/"+row.id);
    else if(row.kind==="room") openPage({view:"rooms",room:row.id});
    else if(row.kind==="work") openPage({view:"workbench",conversation:row.id});
    else openPage({view:"agent-chat",chat:row.id});
  }
  function visible(rows:Item[],limit:number,expanded:boolean){
    return rows.filter((row,index)=>expanded || index<limit || active(row) || row.unread>0);
  }
  function row(item:Item){
    const label=item.title+(item.unread?"，"+item.unread+" 条未读":"");
    return <button key={item.kind+item.id} className="mw-nav-row" title={label} aria-label={label}
      aria-current={active(item)?"page":undefined} onClick={()=>open(item)}>
      {item.kind==="issue"?statusIcon(item.status):<MessageSquare size={14}/>}
      <span>{item.title}</span>{item.tag&&<em>{item.tag}</em>}
      {item.unread>0&&<b>{item.unread>99?"99+":item.unread}</b>}
    </button>;
  }
  return <>
    <nav aria-label="空间导航" className="mw-space-links">
      {[{id:"settings",label:"协作空间",Icon:Users},{id:"agents",label:"智能体",Icon:Bot},{id:"squads",label:"智能体小队",Icon:Network}]
        .filter(item=>show(item.id)).map(({id,label,Icon})=><button key={id} aria-current={view===id?"page":undefined}
        onClick={()=>openPage({view:id})}><Icon size={16}/><span>{label}</span></button>)}
    </nav>
    <div className="wb-sidebar-scroll mw-sidebar-regions">
      <section aria-label="最近会话">
        <header><span>最近会话</span><button className="mw-room-browser" aria-label="全部会话" title="全部会话" onClick={()=>openPage({view:"rooms"})}><MessagesSquare size={14}/></button></header>
        {visible(recent,5,allRecent).map(row)}
        {recent.length>5&&<button className="mw-nav-more" onClick={()=>setAllRecent(!allRecent)}>{allRecent?"收起":"查看全部会话"}<ChevronDown size={12}/></button>}
        {items.data&&!recent.length&&<p>没有匹配的会话</p>}
        <Failure error={items.error} retry={()=>void items.refetch()}/>
      </section>
      <section aria-label="看板视图"><header><span>看板视图</span>{showTasks&&<button aria-label="浏览全部视图" title="浏览全部视图" onClick={()=>openPage({view:"tasks",directory:"1"})}><List size={14}/></button>}</header>
        {showTasks&&<button className="mw-nav-row" aria-current={view==="tasks"&&!params.has("scope")&&!params.has("directory")?"page":undefined} onClick={()=>openPage({view:"tasks"})}><LayoutGrid size={15}/><span>全部任务</span></button>}
        <button className="mw-nav-row" aria-current={view==="projects"?"page":undefined} onClick={()=>openPage({view:"projects"})}><Folder size={15}/><span>全部项目</span></button>
        {(allPins?pins:pins.slice(0,3)).map(p=><button className="mw-nav-row" key={p.id} aria-current={params.get("pin")===p.id?"page":undefined} onClick={()=>openPage({view:"workbench",pin:p.id})}><PanelsTopLeft size={15}/><span>{p.name}</span></button>)}
        {pins.length>3&&<button className="mw-nav-more" onClick={()=>setAllPins(!allPins)}>{allPins?"收起":"显示更多（"+(pins.length-3)+"）"}</button>}
      </section>
      <section aria-label="与我有关"><header>与我有关</header>
        {[...groups.entries()].map(([id,rows])=>{
          const title=rows[0].project_title||"未关联项目", unread=rows.reduce((sum,i)=>sum+i.unread,0);
          const sorted=[...rows].sort((a,b)=>Number(a.kind==="issue")-Number(b.kind==="issue"));
          return <div className="v3-nav-folder" key={id}>
            <button aria-label={(closed[id]?"展开项目 ":"收起项目 ")+title} aria-expanded={!closed[id]} onClick={()=>setClosed({...closed,[id]:!closed[id]})}>
              <ChevronRight className={!closed[id]?"open":""} size={11}/><Folder size={15}/><span>{title}</span><small className={unread?"mw-folder-unread":undefined}>{unread?unread+" 未读":rows.length}</small>
            </button>
            {!closed[id]&&<div>{visible(sorted,4,more[id]).map(row)}
              {rows.length>4&&<button className="mw-nav-more" onClick={()=>setMore({...more,[id]:!more[id]})}>{more[id]?"收起":"查看其余 "+(rows.length-4)+" 条"}<ChevronDown size={11}/></button>}
            </div>}
          </div>;
        })}
        {items.data&&!groups.size&&<p>与你有关的会话会按项目收纳在这里</p>}
      </section>
    </div>
  </>;
}
