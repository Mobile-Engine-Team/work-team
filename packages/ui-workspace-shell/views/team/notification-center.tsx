import {useEffect,useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import {Bell,Check,CheckCheck,ClipboardCheck,MessageSquare,Users,X} from "lucide-react";
import type {InboxItem} from "@multica/core/types";
import {teamApi,useTeam,useTeamAction} from "./client";
import {Failure} from "./ui";

export function NotificationCenter(){
  const {workspace,user}=useTeam(),navigate=useNavigate();
  const [open,setOpen]=useState(false),[all,setAll]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
  const items=useQuery({queryKey:["team",workspace.id,"inbox",false,user.id],queryFn:()=>teamApi.listInbox(),refetchInterval:5000});
  const unread=items.data?.filter(item=>!item.read)||[];
  const rows=all?(items.data||[]):unread;
  const mark=useTeamAction((id:string)=>teamApi.markInboxRead(id));
  const markAll=useTeamAction(()=>teamApi.markAllInboxRead());
  const close=()=>{setOpen(false);trigger.current?.focus()};
  useEffect(()=>{
    if(!open)return;
    panel.current?.focus();
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.stopPropagation();close()}};
    window.addEventListener("keydown",escape);
    return ()=>window.removeEventListener("keydown",escape);
  },[open]);
  const go=(item:InboxItem)=>{
    if(!item.read)mark.mutate(item.id);
    const base="/team/"+workspace.slug,d=item.details;
    if(d?.invitation_id && d.invitation_status==="pending")navigate(base+"?invitation="+encodeURIComponent(d.invitation_id));
    else if(d?.invitation_id && d.invitation_status==="accepted")navigate(base+"?view=settings&members=1");
    else if(d?.room_id)navigate(base+"?"+new URLSearchParams({view:"rooms",room:d.room_id,...(d.message_id?{message:d.message_id}:{})}));
    else if(item.issue_id)navigate(base+"/issue/"+item.issue_id+(d?.comment_id?"?comment="+encodeURIComponent(d.comment_id):""));
    else if(d?.project_id)navigate(base+"?"+new URLSearchParams({view:"projects",project:d.project_id}));
    else navigate(base+"?view=inbox");
    setOpen(false);
  };
  return <div className="v3-top-actions"><span>MW–V3</span>
    <button ref={trigger} className="mw-notice-bell" aria-label={"通知"+(unread.length?"，"+unread.length+" 条未读":"")} aria-expanded={open} title="通知" onClick={()=>setOpen(!open)}>
      <Bell size={16}/>{unread.length>0&&<b>{unread.length>99?"99+":unread.length}</b>}
    </button>
    {open&&<><div className="mw-notice-scrim" onClick={close}/>
      <aside className="mw-notice-panel" role="dialog" aria-label="通知中心" tabIndex={-1} ref={panel}>
        <header><div><h2>通知</h2><p>{unread.length?"有 "+unread.length+" 条动态等你查看":"你的协作动态，都在这里"}</p></div><button aria-label="关闭通知" onClick={close}><X size={18}/></button></header>
        <div className="mw-notice-tools"><div role="tablist" aria-label="通知筛选">
          <button role="tab" aria-selected={!all} onClick={()=>setAll(false)}>未读{unread.length>0&&<span>{unread.length}</span>}</button>
          <button role="tab" aria-selected={all} onClick={()=>setAll(true)}>全部</button></div>
          <button className="mw-notice-read-all" disabled={!unread.length||markAll.isPending} onClick={()=>markAll.mutate()}><CheckCheck size={14}/>全部已读</button>
        </div>
        <Failure error={items.error||mark.error||markAll.error} retry={()=>void items.refetch()}/>
        <div className="mw-notice-list">
          {rows.map(item=>{
            const kind=item.details?.invitation_id?"邀请":item.details?.room_id?"讨论":item.issue_id?"任务":"动态";
            const Icon=kind==="邀请"?Users:kind==="讨论"?MessageSquare:kind==="任务"?ClipboardCheck:Bell;
            return <article className={"mw-notice-item"+(!item.read?" is-unread":"")} key={item.id}>
              <button className="mw-notice-open" onClick={()=>go(item)}><span className="mw-notice-icon"><Icon size={16}/></span>
                <div><div className="mw-notice-meta"><small>{kind}</small><time>{new Date(item.created_at).toLocaleString()}</time></div>
                <strong>{item.title}</strong>{item.body&&<p>{item.body}</p>}</div></button>
              {!item.read&&<button className="mw-notice-mark" title="标为已读" aria-label={"标为已读："+item.title} disabled={mark.isPending} onClick={()=>mark.mutate(item.id)}><Check size={14}/></button>}
            </article>;
          })}
          {items.data&&!rows.length&&<div className="mw-notice-empty"><span><Bell size={26}/></span><h3>{all?"暂无通知":"没有未读通知"}</h3></div>}
        </div><footer><i className="mw-notice-live"/><button onClick={()=>{setOpen(false);navigate("/team/"+workspace.slug+"?view=inbox")}}>查看收件箱</button></footer>
      </aside></>}
  </div>;
}
