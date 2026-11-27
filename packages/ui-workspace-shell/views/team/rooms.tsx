import {MessageCircle, MessageSquare, Users as MemberIcon} from "lucide-react";
import workAvatar from "../../../../mloop/design-v3/ai-message-avatar.svg?inline";
import { ArrowLeft, ArrowUpRight, AtSign, Bot, ChevronRight, Copy, FileText, Folder, ListTodo, Plus, Search, Settings, Users, Send, X } from "../icons";
import {RoomSearch} from "./room-search";
import {readAttachment} from "../workbench/composer-files";
import { SidePanel } from "./work-tools";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { IDSchema, request } from "../workbench/api";
import {
  teamApi,
  teamServer,
  useTeam,
  useTeamAction,
  useTeamQuery,
} from "./client";
import { teamFetch } from "./request-transport";
import {
  Action,
  Empty,
  Failure,
  Field,
  Input,
  Modal,
  Picker,
  Textarea,
} from "./ui";


function avatarTone(name:string) {
  return Array.from(name).reduce((sum,char)=>sum+char.charCodeAt(0),0)%4;
}

const Room = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.string(),
  project_id: z.string().nullable(),
});
const Detail = Room.extend({
  revision: z.number(),
  owner_id: z.string(),
  project_title: z.string().nullable(),
  linked_tasks: z.array(z.object({id:z.string(),title:z.string()})),
  members: z.array(z.string()),
  messages: z.array(
    z.object({
      agent: z
        .object({
          name: z.string(),
          status: z.string(),
          error: z.string(),
          answer: z.string(),
        })
        .nullable()
        .optional(),
      work: z
        .object({ status: z.string(), answer: z.string(), failure: z.string() })
        .nullable()
        .optional(),
      id: z.string(),
      sender_id: z.string(),
      content: z.string(),
      created_at: z.string(),
      filename: z.string(),
      files:z.array(z.object({id:z.string(),filename:z.string()})),
      tasks: z.array(z.string()),
    }),
  ),
});
export function IssueSource({ id }: { id: string }) {
  const { workspace, user } = useTeam();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey:["team",workspace.id,"source",user.id,id],
    queryFn:()=>request(workspace.id, "/issue-source/"+id, z.object({
      source:z.object({id:z.string(), title:z.string(), message_id:z.string(), kind:z.string().optional()}).nullable(),
    })),
    staleTime:0, refetchOnMount:"always", refetchOnWindowFocus:"always", refetchInterval:2500,
  });
  const result = query.isFetchedAfterMount && !query.isError ? query.data : undefined;
  const source = result?.source;
  return <section className="v3-issue-source">
    <h3>任务来源</h3><Failure error={query.error}/>
    {source ? <button className="v3-open-source" aria-label={source.title} onClick={()=>navigate(
      "/team/"+workspace.slug+"?"+(source.kind==="work" ? "view=workbench&conversation=" : "view=rooms&room=")+source.id+"&message="+source.message_id
    )}><MessageCircle size={15}/><span><strong>{source.title}</strong><small>创建此任务的会话</small></span><ChevronRight size={13}/></button>
    : result && <p>没有来源会话</p>}
  </section>;
}
export function RoomPage() {
  const { workspace, user } = useTeam();
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(params.get("create") === "1");
  const [search, setSearch] = useState("");
  const rooms = useQuery({
    queryKey: ["team", workspace.id, "rooms", user.id, search],
    queryFn: () =>
      request(
        workspace.id,
        "/rooms?q=" + encodeURIComponent(search),
        Room.array(),
      ),
    refetchInterval: 3500,
  });
  const open = (room: string) => setParams({ view: "rooms", room });
  if (params.get("room"))
    return (
      <Conversation
        key={[workspace.id,user.id,params.get("room")].join(":")}
        id={params.get("room")!}
        back={() => setParams({ view: "rooms" })}
      />
    );
  return (
    <section>
      <header className="team-toolbar">
        <h1>会话</h1>
        <Action primary onClick={() => setCreate(true)}>
          新建会话
        </Action>
      </header>
      <Input
        aria-label="搜索会话"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索会话名称或消息"
      />
      <Failure error={rooms.error} />
      {!rooms.error && rooms.data?.length === 0 && (
        <Empty>{search ? "没有匹配的会话" : "暂无会话"}</Empty>
      )}
      {!rooms.error &&
        rooms.data?.map((room) => (
          <button
            className="team-setting-row"
            key={room.id}
            onClick={() => open(room.id)}
          >
            {room.title}
            <small>{room.kind === "direct" ? "私聊" : "群聊"}</small>
          </button>
        ))}
      {create && <CreateRoom onClose={() => setCreate(false)} onOpen={open} />}
    </section>
  );
}
function CreateRoom({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const { workspace, user } = useTeam();
  const members = useTeamQuery(["members"], () =>
    teamApi.listMembers(workspace.id),
  );
  const projects = useTeamQuery(["projects"], () => teamApi.listProjects());
  const [title, setTitle] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [project, setProject] = useState("");
  const create = useTeamAction(async () => {
    const result = await request(workspace.id, "/rooms", IDSchema, {
      title: title.trim(),
      kind: selected.length === 1 ? "direct" : "group",
      members: selected,
      project_id: project,
    });
    onOpen(result.id);
    onClose();
  });
  return (
    <Modal title="新建会话" onClose={onClose}>
      <Field label="会话名称">
        <Input
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="所属项目">
        <Picker
          label="所属项目"
          value={project}
          onChange={setProject}
          options={[
            { value: "", label: "无关联项目" },
            ...(projects.data?.projects || []).map((p) => ({
              value: p.id,
              label: p.title,
            })),
          ]}
        />
      </Field>
      <h3>参与成员</h3>
      {members.data
        ?.filter((m) => m.user_id !== user.id)
        .map((m) => (
          <label className="team-setting-row" key={m.id}>
            <input
              type="checkbox"
              checked={selected.includes(m.user_id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, m.user_id]
                    : selected.filter((id) => id !== m.user_id),
                )
              }
            />
            {m.name} · {m.email}
          </label>
        ))}
      <Failure error={create.error || members.error || projects.error} />
      <Action onClick={onClose}>取消</Action>
      <Action
        primary
        disabled={!title.trim() || !selected.length || create.isPending}
        onClick={() => create.mutate()}
      >
        创建会话
      </Action>
    </Modal>
  );
}
function Conversation({ id, back }: { id: string; back: () => void }) {
  const { workspace, user } = useTeam();
  const navigate = useNavigate();
  const room = useQuery({
    queryKey: ["team", workspace.id, "rooms", user.id, id],
    queryFn: () => request(workspace.id, "/rooms/" + id, Detail),
    refetchInterval: 2000,
    retry: false,
  });
  const members = useTeamQuery(["members"], () =>
    teamApi.listMembers(workspace.id),
  );
  const [params] = useSearchParams();
  const [settings,setSettings]=useState(false);
  const [nextTitle,setNextTitle]=useState("");
  const [composingTitle,setComposingTitle]=useState(false);
  const projects=useTeamQuery(["projects"],()=>teamApi.listProjects(),settings);
  const [newProject,setNewProject]=useState("");
  const [invitee,setInvitee]=useState("");
  type Participant = {id:string; name:string; agent:boolean};
  const [removeTarget,setRemoveTarget]=useState<Participant|null>(null);
  const openedRoom=useRef<{revision:number; title:string; project:string; members:string[]}|null>(null);
  const writes=useRef(Promise.resolve());
  const configure=useTeamAction(async (edit: {title?:string; project?:string; createProject?:string; add?:Participant; remove?:Participant})=>{
    const opened=openedRoom.current;
    if(!opened) return;
    const save=writes.current.then(async ()=>{
      const title=(edit.title ?? opened.title).trim();
      const project=edit.project ?? opened.project;
      if(!title) throw Error("请输入会话名称");
      if(title===opened.title && project===opened.project && !edit.createProject && !edit.add && !edit.remove) return;
      const people=edit.add && !edit.add.agent ? [...new Set([...opened.members,edit.add.id])]
        : edit.remove && !edit.remove.agent ? opened.members.filter(uid=>uid!==edit.remove!.id) : undefined;
      const ack=await request(workspace.id,"/rooms/"+id,
        z.object({id:z.string(),revision:z.number(),title:z.string(),project_id:z.string().nullable()}),{
          revision:opened.revision,title,project_id:edit.createProject ? "" : project,new_project:edit.createProject,
          members:people,add_agents:edit.add?.agent?[edit.add.id]:undefined,remove_agents:edit.remove?.agent?[edit.remove.id]:undefined,
        },"PUT");
      Object.assign(opened,{revision:ack.revision,title:ack.title,project:ack.project_id || "",members:people || opened.members});
      await room.refetch();
      if(openedRoom.current===opened){
        if(edit.createProject) setNewProject("");
        if(edit.add) setInvitee("");
        if(edit.remove) setRemoveTarget(null);
      }
    });
    writes.current=save.catch(()=>{});
    return save;
  });
  const saveTitle=()=>{
    if(!composingTitle && nextTitle.trim() && openedRoom.current && nextTitle.trim()!==openedRoom.current.title) configure.mutate({title:nextTitle});
  };
  useEffect(()=>{
    if(!settings || composingTitle || room.data?.owner_id!==user.id || !nextTitle.trim() || nextTitle.trim()===openedRoom.current?.title) return;
    const timer=window.setTimeout(saveTitle,500);
    return ()=>window.clearTimeout(timer);
  },[settings,nextTitle,composingTitle,room.data?.owner_id,user.id]);
  const client=useQueryClient();
  const lastMessage = room.data?.messages.at(-1)?.id;
  useEffect(() => {
    if (lastMessage)
      void request(
        workspace.id,
        "/rooms/" + id + "/read",
        z.object({ count: z.number() }),
        { last: lastMessage },
      ).then(()=>client.invalidateQueries({queryKey:["team",workspace.id,"navigation"]})).catch(() => {});
  }, [id, workspace.id, lastMessage,client]);
  const scrollTo = params.get("message");
  useEffect(() => {
    if (scrollTo && room.data)
      document
        .getElementById("msg-" + scrollTo)
        ?.scrollIntoView({ block: "center" });
  }, [scrollTo, room.data?.id]);
  const [panel, setPanel] = useState<"" | "search" | "work" | "members">("");
  const [copied,setCopied]=useState("");
  const [mention,setMention]=useState<"" | "all" | "people" | "agents">("");
  const draftKey = ["mobilework","room-draft",workspace.id,user.id,id].join(":");
  const [content, setDraft] = useState(() => sessionStorage.getItem(draftKey) || ""),

    [files, setFiles] = useState<File[]>([]);
  const [fileError,setFileError] = useState("");
  const input=useRef<HTMLTextAreaElement>(null);
  const history=useRef<HTMLDivElement>(null);
  const followLatest=useRef(true);
  useEffect(()=>{
    if (!scrollTo && followLatest.current && history.current)
      history.current.scrollTop=history.current.scrollHeight;
  },[lastMessage,scrollTo]);
  useEffect(()=>{
    const close=(event: KeyboardEvent)=>{
      if (event.key!=="Escape" || event.defaultPrevented || document.querySelector('[aria-modal="true"],[data-slot="select-content"]')) return;
      if(mention){setMention("");return}
      setPanel("");setSettings(false);
    };
    window.addEventListener("keydown",close);return ()=>window.removeEventListener("keydown",close);
  },[mention]);
  const agentTargetSchema=z.object({id:z.string().uuid(),name:z.string(),builtin:z.boolean()});
  const agents=useQuery({
    queryKey:["team",workspace.id,"room-mentions",id,user.id,room.data?.revision],
    queryFn:()=>request(workspace.id,"/rooms/"+id+"/mentions",agentTargetSchema.extend({joined:z.boolean()}).array()),
    enabled:!!room.data && !room.error,
    refetchOnWindowFocus:"always",
    refetchInterval:settings || panel==="members" || !!mention ? 2500 : false,
  });
  const targetKey=draftKey+":agent";
  const [target,setTarget]=useState(()=>{
    try{return agentTargetSchema.nullable().parse(JSON.parse(sessionStorage.getItem(targetKey)||"null"))}catch{return null}
  });
  function selectTarget(t:typeof target){
    setTarget(t);
    if(t) sessionStorage.setItem(targetKey,JSON.stringify(t));else sessionStorage.removeItem(targetKey);
  }
  const setContent=(value:string)=>{
    setDraft(value);
    if(target && !value.includes("@"+target.name))selectTarget(null);
    if(value) sessionStorage.setItem(draftKey,value);
    else sessionStorage.removeItem(draftKey);
  };
  const [task, setTask] = useState<{ msg: string; key: string } | null>(null);
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState("");
  const send = useTeamAction(async () => {
    const attachments = await Promise.all(files.map(file=>readAttachment(file,file.name)));
    const key=draftKey+":pending";
    const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([content,attachments,target?.id||""])))),b=>b.toString(16).padStart(2,"0")).join("");
    const [priorFingerprint,priorId]=(sessionStorage.getItem(key)||"").split(":");
    const messageKey=priorFingerprint===fingerprint && priorId ? priorId : crypto.randomUUID();
    sessionStorage.setItem(key,fingerprint+":"+messageKey);
    await request(workspace.id, "/rooms/" + id + "/messages", IDSchema, {
      content,
      files: attachments, agent_id: target?.id,
      request_id: messageKey,
    });
    setContent("");
    setFiles([]);setFileError("");
    sessionStorage.removeItem(key);
  });
  const openIssue = (issue: string) =>
    navigate(`/team/${workspace.slug}/issue/${issue}`);
  const convert = useTeamAction(async () => {
    if (!task) return;
    const result = await request(
      workspace.id,
      "/room-messages/" + task.msg + "/task",
      IDSchema,
      { title, description, request_id: task.key },
    );
    setTask(null);
    openIssue(result.id);
  });
  const download = useTeamAction(
    async ({ msg, name }: { msg: string; name: string }) => {
      const r = await teamFetch(
        teamServer + "/api/workbench/room-files/" + msg,
        { headers: { "X-Workspace-ID": workspace.id } },
      );
      if (!r.ok) throw Error("文件不可用");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  );
  const retryWork = useTeamAction(async (msg: string) => {
    await request(
      workspace.id,
      "/room-messages/" + msg + "/retry",
      z.object({ status: z.string() }),
      {},
    );
    await room.refetch();
  });
  if (room.error || !room.data)
    return (
      <>
        <Action onClick={back}>返回会话</Action>
        <Failure error={room.error} />
      </>
    );
  const visibleMembers=(members.data || []).filter(m=>room.data.members.includes(m.user_id));
  const participantName=(uid:string)=>visibleMembers.find(m=>m.user_id===uid)?.name || "成员";
  const canEdit=room.data.owner_id===user.id;
  const availableAgents=agents.data || [];
  const joinedAgents=availableAgents.filter(agent=>agent.joined);
  const memberAgentName=(agent:typeof availableAgents[number])=>agent.builtin ? participantName(room.data.owner_id)+"的 Work 助手" : agent.name;
  const addInvitee=()=>{
    const agent=invitee.startsWith("agent:") ? availableAgents.find(row=>row.id===invitee.slice(6)) : undefined;
    if(invitee && (!invitee.startsWith("agent:") || agent)) configure.mutate({add:agent ? {id:agent.id,name:memberAgentName(agent),agent:true} : {id:invitee,name:participantName(invitee),agent:false}});
  };
  const openSettings=()=>{
    const current=room.data;
    openedRoom.current={revision:current.revision,title:current.title,project:current.project_id || "",members:current.members};
    setPanel("");setSettings(true);setInvitee("");setNewProject("");setComposingTitle(false);setNextTitle(current.title);setRemoveTarget(null);configure.reset();
  };
  const togglePanel=(next:typeof panel)=>{setSettings(false);setMention("");setPanel(current=>current===next ? "" : next);};
  const copyLink=async()=>{try{await navigator.clipboard.writeText(location.href);setCopied("已复制")}catch{setCopied("请从地址栏复制")}};
  const chooseMention=(name:string,agent?:NonNullable<typeof target>)=>{
    const el=input.current, end=el?.selectionStart ?? content.length, tail=el?.selectionEnd ?? end;
    const before=content.slice(0,end).replace(/@[^@\s]*$/u,"");
    const prefix=before+(before && !/\s$/.test(before) ? " " : "")+"@"+name+" ";
    setContent(prefix+content.slice(tail));if(agent)selectTarget(agent);setMention("");
    requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(prefix.length,prefix.length)});
  };
  return (
    <section className={"v3-room"+(panel || settings ? " room-with-panel" : "")}>
      <div className="room-main">
      <header className="room-header">
        <div className="room-topic">
          {room.data.project_id && <><button className="room-project" onClick={()=>navigate("/team/"+workspace.slug+"?view=projects&project="+room.data.project_id+"&section=overview")}><Folder size={14}/>{room.data.project_title}</button><ChevronRight size={13}/></>}
          <h1>{room.data.title}</h1></div>
        <div className="room-header-actions">
          <button aria-label="搜索会话消息" aria-expanded={panel==="search"} onClick={()=>togglePanel("search")}><Search size={17}/></button>
          <button aria-label="打开临时 Work 聊天" aria-expanded={panel==="work"} onClick={()=>togglePanel("work")}><MessageSquare size={17}/></button>
          <button aria-label="查看参与成员" className="room-people" aria-expanded={panel==="members"} onClick={()=>togglePanel("members")}>
            <span>{visibleMembers.slice(0,3).map(m=><i key={m.id} data-tone={avatarTone(m.name || "")}>{m.name?.slice(0,1)}</i>)}</span>{room.data.members.length+joinedAgents.length}
          </button>
          <button aria-label="会话设置" aria-expanded={settings} onClick={openSettings}><Settings size={17}/></button>
        </div>
      </header>
      {!!room.data.linked_tasks.length && <nav className="room-linked" aria-label="关联任务"><span>关联任务</span>{room.data.linked_tasks.map(t=><button key={t.id} onClick={()=>openIssue(t.id)}><ListTodo size={14}/>{t.title}<ChevronRight size={12}/></button>)}</nav>}
      <div className="room-history" ref={history} onScroll={e=>{const el=e.currentTarget;followLatest.current=el.scrollHeight-el.scrollTop-el.clientHeight<90;}}>
      {!room.data.messages.length&&<Empty>暂无消息</Empty>}
      {room.data.messages
        .map((m) => (
          <article
            className={"room-message"+(m.sender_id===user.id?" room-mine":"")}
            tabIndex={-1} key={m.id}
            id={"msg-" + m.id}
          >
            <header>
              {m.sender_id!==user.id && <i className="room-avatar" data-tone={avatarTone(participantName(m.sender_id))}>{participantName(m.sender_id).slice(0,1)}</i>}
              <strong>{participantName(m.sender_id)}</strong><time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", hour12:false})}</time>
            </header><div className="room-message-body">
            {m.content && <p className="v3-chat-message">{m.content}</p>}
            {m.files.map(f=><button key={f.id} className="room-file" aria-label={f.filename} onClick={()=>download.mutate({msg:f.id,name:f.filename})}><i><FileText size={20}/></i><span><strong>{f.filename}</strong><small>附件 · 点击下载</small></span><ArrowUpRight size={13}/></button>)}
            <Action className="room-message-action"
              onClick={() => {
                setTitle("");
                setDescription("");
                setTask({ msg: m.id, key: crypto.randomUUID() });
              }}
            >
              将此消息整理为任务
            </Action>
            {m.agent && (
              <section>
                <strong>{m.agent.name}</strong>
                <p>
                  {m.agent.answer ||
                    m.agent.error ||
                    {
                      pending: "等待派发",
                      dispatching: "正在请求执行",
                      queued: "已入队",
                      running: "执行中",
                      completed: "已完成",
                      failed: "执行失败",
                    }[m.agent.status] ||
                    m.agent.status}
                </p>
                {m.agent.error &&
                  m.agent.status === "failed" &&
                  m.sender_id === user.id && (
                    <Action
                      disabled={retryWork.isPending}
                      onClick={() => retryWork.mutate(m.id)}
                    >
                      重试派发
                    </Action>
                  )}
              </section>
            )}
            {m.work && (
              <section aria-label="Work 回复">
                <strong>Work</strong>
                <p>
                  {m.work.status === "completed"
                    ? m.work.answer
                    : m.work.status === "failed"
                      ? m.work.failure
                      : m.work.status === "running"
                        ? "正在处理"
                        : "已排队"}
                </p>
                {m.work.status === "failed" && m.sender_id === user.id && (
                  <Action
                    disabled={retryWork.isPending}
                    onClick={() => retryWork.mutate(m.id)}
                  >
                    重试
                  </Action>
                )}
              </section>
            )}
            {m.tasks.map((issue) => (
              <Action key={issue} onClick={() => openIssue(issue)}>
                查看任务
              </Action>
            ))}
          </div></article>
        ))}
      </div><div className="room-composer-wrap"><form className="room-composer"
        onSubmit={(e) => {
          e.preventDefault();
          if (!send.isPending && (content.trim() || files.length)) send.mutate();
        }}
      >
        {!!files.length && <div className="room-file-queue">{files.map((f,i)=><button type="button" key={i} disabled={send.isPending} aria-label={"移除附件 "+f.name} onClick={()=>{setFiles(files.filter((_,index)=>index!==i));}}><FileText size={14}/>{f.name}<X size={12}/></button>)}</div>}
        {fileError && <small role="alert">{fileError}</small>}
        <Textarea
          ref={input} placeholder="发送消息。@成员协作，@智能体参与工作" aria-label="会话消息"
          value={content}
          disabled={send.isPending}
          onChange={(e) => {const value=e.target.value;setContent(value);setMention(/(?:^|\s)@[^@\s]*$/.test(value.slice(0,e.target.selectionStart))?"all":"");}}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div className="room-actions"><label title="添加附件"><Plus size={18}/><input hidden type="file" multiple aria-label="添加附件" disabled={send.isPending} onChange={e=>{
          const added=Array.from(e.target.files || []);e.target.value="";
          if(files.length+added.length>4 || added.some(f=>f.size>3*1024*1024)){setFileError("每条消息最多四个附件，单个文件上限 3 MB");return}
          setFiles([...files,...added]);setFileError("");
        }}/></label>
      <button type="button" onClick={()=>setMention(mention==="people"?"":"people")}><AtSign size={15}/>成员</button>
      <button type="button" onClick={()=>setMention(mention==="agents"?"":"agents")}><Bot size={15}/>智能体</button>
      <button type="button"
        onClick={() => {setMention("");
          setContent(
            "@Work 请分析当前会话记录，提炼可执行事项，创建任务并关联到本会话。\n\n",
          );
          requestAnimationFrame(() =>
            document
              .querySelector<HTMLTextAreaElement>('[aria-label="会话消息"]')
              ?.focus(),
          );
        }}
      >
        <ListTodo size={15}/>转为任务
      </button>

        {mention && <div className="room-mentions" role="dialog" aria-label="选择提及对象">
          {mention!=="agents" && visibleMembers.map(m=><button key={m.id} type="button" onClick={()=>chooseMention(m.email)}><Users size={15}/>{m.name}<small>{m.email}</small></button>)}
          {mention!=="people" && (agents.data || []).map(a=><button key={a.id} type="button" onClick={()=>chooseMention(a.name,a)}><Bot size={15}/>{a.name}</button>)}
          {mention==="agents" && agents.data?.length===0 && <small>当前会话没有可提及的智能体。</small>}
          <Failure error={agents.error}/>
        </div>}
        <button className="room-send" aria-label="发送消息" disabled={send.isPending || (!content.trim() && !files.length)}>
          <Send size={16}/>
        </button></div>
      </form><div className="room-caption"><span>@成员协作，@智能体参与工作</span><span>Enter 发送 · Shift Enter 换行</span></div></div>
      <Failure error={send.error || download.error || retryWork.error} /></div>
      {panel==="search" && <RoomSearch ws={workspace.id} id={id} close={()=>setPanel("")} openIssue={openIssue}/>}
      {panel==="work" && <SidePanel key={id} ws={workspace.id} kind="room" id={id} close={()=>setPanel("")}/>}
      {(settings || panel==="members") && <aside className="room-management" role="dialog" aria-label={settings?"会话设置":"参与成员"}>
        <header><h2>{settings?"会话设置":"参与成员"}</h2><button aria-label="关闭" onClick={()=>{setSettings(false);setPanel("")}}><X size={16}/></button></header>
        {settings && <><section>
          <h3><MessageSquare size={16}/>会话信息</h3>
          <Field label="会话名称"><Input value={nextTitle} disabled={!canEdit} maxLength={100} onChange={e=>setNextTitle(e.target.value)}
            onCompositionStart={()=>setComposingTitle(true)} onCompositionEnd={e=>{setNextTitle(e.currentTarget.value);setComposingTitle(false);}}
            onBlur={saveTitle} onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();saveTitle();}}}/>
            {!nextTitle.trim() && <small role="alert">请输入会话名称</small>}</Field>
          <div className="room-setting-inline room-share"><small>邀请伙伴加入这段讨论</small><Action onClick={copyLink}>复制会话链接</Action></div>{copied&&<small role="status">{copied}</small>}
        </section><section><h3><Folder size={16}/>所属项目</h3>
          <select className="room-project-select" aria-label="所属项目" value={room.data.project_id || ""}
            onChange={e=>configure.mutate({project:e.target.value})} disabled={!canEdit || projects.isPending || configure.isPending}>
            <option value="">无关联项目</option>
            {room.data.project_id && !projects.data?.projects.some(project=>project.id===room.data.project_id) &&
              <option value={room.data.project_id}>{room.data.project_title}</option>}
            {(projects.data?.projects || []).map(project=><option key={project.id} value={project.id}>{project.title}</option>)}
          </select>
          {canEdit&&<div className="room-setting-inline"><Input aria-label="新项目名称" placeholder="或创建一个项目" value={newProject} onChange={e=>setNewProject(e.target.value)}/>
            <Action disabled={!newProject.trim() || !nextTitle.trim() || configure.isPending} onClick={()=>configure.mutate({createProject:newProject.trim(),title:nextTitle})}>创建并关联</Action></div>}
        </section></>}
        <section><h3><MemberIcon size={16}/>参与成员<small>{room.data.members.length+joinedAgents.length}</small></h3>
          <div className="room-member-list">{(members.data || []).filter(m=>room.data.members.includes(m.user_id)).map(m=><div key={m.id}>
            <i className="room-avatar" data-tone={avatarTone(m.name || "")}>{m.name?.slice(0,1)}</i><span>{m.name}<small>协作成员</small></span>
            {settings && canEdit && room.data.kind==="group" && m.user_id!==user.id && <button aria-label={"移除 "+m.name} onClick={()=>setRemoveTarget({id:m.user_id,name:m.name || "成员",agent:false})}><X size={14}/></button>}
          </div>)}
          {joinedAgents.map(agent=><div key={agent.id}><i className="room-avatar"><img src={workAvatar} alt=""/></i>
            <span>{memberAgentName(agent)}<small>智能体</small></span>
            {settings && canEdit && room.data.kind==="group" && <button aria-label={"移除 "+memberAgentName(agent)} onClick={()=>setRemoveTarget({id:agent.id,name:memberAgentName(agent),agent:true})}><X size={14}/></button>}
          </div>)}</div>
          {settings && canEdit && room.data.kind==="group" && <div className="room-setting-inline">
            <Picker label="邀请空间成员" value={invitee} onChange={setInvitee} options={[{value:"",label:"邀请空间成员"},...(members.data || []).filter(m=>!room.data.members.includes(m.user_id)).map(m=>({value:m.user_id,label:m.name+" · "+m.email})),
              ...availableAgents.filter(agent=>!agent.joined).map(agent=>({value:"agent:"+agent.id,label:memberAgentName(agent)}))]}/>
            <Action disabled={!invitee || configure.isPending} onClick={addInvitee}>邀请</Action></div>}
          {settings && canEdit && room.data.kind==="group" && <p className="room-invite-hint">可邀请自己的 Work 助手。成员能否调用智能体取决于各自的权限。</p>}
          {removeTarget && <Modal title="移除会话成员" onClose={()=>setRemoveTarget(null)}>
            <p>从本次会话移除「{removeTarget.name}」？</p>
            <div className="team-actions"><Action disabled={configure.isPending} onClick={()=>setRemoveTarget(null)}>取消</Action>
              <Action primary disabled={configure.isPending} onClick={()=>configure.mutate({remove:removeTarget})}>确认移除</Action></div>
            <Failure error={configure.error}/>
          </Modal>}
          <Failure error={configure.error || projects.error || members.error || agents.error}/>
        </section>
        {settings && <section><h3><ListTodo size={16}/>关联任务</h3>
          {room.data.linked_tasks.map(t=><Action key={t.id} onClick={()=>openIssue(t.id)}>{t.title}</Action>)}
          <Action disabled={!lastMessage} onClick={()=>{if(lastMessage){setTitle("");setDescription("");setTask({msg:lastMessage,key:crypto.randomUUID()});}}}>将讨论整理为任务</Action>
        </section>}
        <Action onClick={back}><ArrowLeft size={15}/>返回会话</Action>
      </aside>}
      {task && (
        <Modal title="转为任务" onClose={() => setTask(null)}>
          <Field label="任务标题">
            <Input
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="任务描述">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <p>任务标题和描述对工作区成员可见。</p>
          <Failure error={convert.error} />
          <Action onClick={() => setTask(null)}>取消</Action>
          <Action
            primary
            disabled={!title.trim() || convert.isPending}
            onClick={() => convert.mutate()}
          >
            创建任务
          </Action>
        </Modal>
      )}
    </section>
  );
}
