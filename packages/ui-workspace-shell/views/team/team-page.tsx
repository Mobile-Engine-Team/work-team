import {NotificationCenter} from "./notification-center";
import {InvitationLink} from "./invitations";
import { WorkspaceAvatar } from "./workspace-avatar";
import { useEffect, useRef, useState } from "react";
import { LoginShell } from "../auth/login-shell";
import { PasswordLoginForm } from "../auth/password-login-form";
import { WorkbenchShell } from "../workbench/workbench";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, ArrowRight, ChevronDown, Check, Search, FlaskConical, Settings, ShieldCheck } from "lucide-react";
import {
  TeamQueryProvider,
  TeamScope,
  teamApi,
  text,
  useTeamAction,
  useTeamSession,
  useTeam,
} from "./client";
import { Action, Field, Input, Picker, Failure, Empty, Modal, TeamConnectionNotice } from "./ui";
import { usePageAssembly } from "../pages";
import { FilesPage } from "./files";
import { JoinLink } from "./space";
import { RoomPage } from "./rooms";
import { ProjectsPage } from "./projects";
import { Invitations, useAcceptWorkspaceInvitation } from "./invitations";
import "./team.css";
export default function TeamPage({ showInvitationNotifications = false }: { showInvitationNotifications?: boolean }) {
  return (
    <TeamQueryProvider>
      <TeamEntry showInvitationNotifications={showInvitationNotifications} />
    </TeamQueryProvider>
  );
}
function TeamEntry({ showInvitationNotifications }: { showInvitationNotifications: boolean }) {
  const { slug, issueId } = useParams();
  const navigate = useNavigate();
  const session = useTeamSession();
  const [routeParams]=useSearchParams();
  const [switching,setSwitching]=useState(false),[filter,setFilter]=useState("");
  const switchRoot=useRef<HTMLDivElement>(null);
  const switchTrigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{
    if(!switching)return;
    const away=(event:PointerEvent)=>{if(!switchRoot.current?.contains(event.target as Node))setSwitching(false)};
    const esc=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();setSwitching(false);switchTrigger.current?.focus()}};
    document.addEventListener("pointerdown",away);
    document.addEventListener("keydown",esc);
    return ()=>{document.removeEventListener("pointerdown",away);document.removeEventListener("keydown",esc)};
  },[switching]);
  const inviteQuery=routeParams.has("join")||routeParams.has("invitation")?"?"+routeParams.toString():"";
  const [create, setCreate] = useState(false);
  const [created,setCreated]=useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [avatar,setAvatar]=useState(""),[reading,setReading]=useState(false);
  const closeCreate=()=>{setCreate(false);setAvatar("");setWorkspaceName("");setDescription("");};
  const [description,setDescription] = useState("");
  const action = useTeamAction(async (mode: string) => {
    if (mode === "logout") { await session.logout(); navigate("/team"); }
    else {
      const demo=mode==="demo";
      const body={name:demo ? "本地演示工作区" : workspaceName.trim(),slug:"team-"+crypto.randomUUID(),description:demo ? "弱网上传 · 蓝图、任务与协作样例" : description.trim(),avatar_url:demo?"":avatar,demo};
      const ws=await teamApi.createWorkspace(body);
      await spaces.refetch();setWorkspaceName("");setDescription("");
      closeCreate();
      navigate(`/team/${ws.slug}?view=projects`);
      if(!demo)setCreated(ws.slug);
    }
  });
  const spaces = useQuery({
    queryKey: ["team", "workspaces"],
    queryFn: () => teamApi.listWorkspaces(),
    enabled: !!session.user.data,
  });
  const invites = useQuery({
    queryKey: ["team", "invitations"],
    queryFn: () => teamApi.listMyInvitations(),
    refetchInterval: 5000,
    enabled: !!session.user.data && !showInvitationNotifications,
  });
  const accept = useAcceptWorkspaceInvitation(session.user.data?.id);
  const workspace = spaces.data?.find((w) => w.slug === slug);
  useEffect(() => {
    if (!slug && spaces.data?.length) {
      const initial = spaces.data.find(w => w.kind === "personal") || spaces.data[0];
      navigate(`/team/${initial.slug}`+inviteQuery, {replace:true});
    }
  }, [slug, spaces.data, navigate]);
  const matchingSpaces=(spaces.data||[]).filter(w=>(w.name+" "+(w.description||"")).toLowerCase().includes(filter.trim().toLowerCase()));
  if (!session.signedIn)
    return (
      <>
        <TeamSignIn onLogin={async (mode, username, password) => { const result = await session.login(mode,username,password); if(result.ok) navigate("/team"+inviteQuery,{replace:true}); return result; }} />
      </>
    );
  if (!session.user.data)
    return (
      <div className="team-root">
        <TeamConnectionNotice />
        <Failure
          error={session.user.error}
          retry={() => void session.user.refetch()}
        />
        <Empty>{text("loading")}</Empty>
        <Action onClick={() => action.mutate("logout")}>
          {text("logout")}
        </Action>
      </div>
    );
  return (
    <div className="team-root">
      {showInvitationNotifications && <Invitations key={session.user.data.id} />}
        <TeamConnectionNotice />
      <header className="team-header">
        <div className="team-heading" ref={switchRoot}>
          <button ref={switchTrigger} className="v3-switch" role="combobox" aria-haspopup="dialog" aria-label="工作区" aria-expanded={switching} onClick={()=>{setFilter("");setSwitching(!switching)}}><small>{workspace?.avatar_url?<img src={workspace.avatar_url} alt="" width={20} height={20}/>:workspace?.name.slice(0,1)}</small>{workspace?.name||"选择工作区"}<ChevronDown size={14}/></button>
          {switching&&<section className="v3-workspaces" role="dialog" aria-label="切换团队">
            <header><strong>切换团队</strong><span>{spaces.data?.length||0} 个团队</span></header>
            <label className="mw-switch-search"><Search size={15}/><input autoFocus aria-label="搜索团队" placeholder="搜索团队" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
            <div className="mw-switch-options">{matchingSpaces.map(w=><button key={w.id} aria-label={"切换到"+w.name} aria-pressed={w.id===workspace?.id}
              onClick={()=>{setSwitching(false);navigate("/team/"+w.slug);switchTrigger.current?.focus()}}>
              <i>{w.avatar_url?<img src={w.avatar_url} alt=""/>:w.name.slice(0,1)}</i>
              <span><strong>{w.name}</strong>{w.description&&<small>{w.description}</small>}</span>{w.id===workspace?.id&&<Check size={16}/>}
            </button>)}{!matchingSpaces.length&&<p>没有找到团队</p>}</div>
            <div className="mw-switch-actions"><button aria-label="新建演示工作区" disabled={action.isPending} onClick={()=>{setSwitching(false);action.mutate("demo")}}><FlaskConical size={16}/>新建演示工作区<small>独立样例</small></button>
            <button onClick={()=>{setSwitching(false);setCreate(true)}}><Plus size={16}/>创建团队</button>
            {workspace&&<button aria-label="团队设置" onClick={()=>{setSwitching(false);navigate("/team/"+workspace.slug+"?view=settings&manage=general")}}><Settings size={16}/>团队设置<small>成员 / 权限</small></button>}</div>
            <footer><Users size={14}/>切换后保留原团队的任务、成员和文件</footer>
          </section>}
        </div>

      </header>
      <Failure
        error={spaces.error || invites.error || action.error || accept.error}
      />
      {workspace ? (
        <TeamScope
          key={workspace.id}
          workspace={workspace}
          user={session.user.data}
        >
          <NotificationCenter key={workspace.id+session.user.data.id}/>
          {routeParams.get("invitation")&&<InvitationLink id={routeParams.get("invitation")!} userId={session.user.data.id} close={()=>navigate("/team/"+workspace.slug,{replace:true})}/>}
          {routeParams.get("join")&&<JoinLink token={routeParams.get("join")!} user={session.user.data.email} onClose={()=>navigate(`/team/${workspace.slug}`,{replace:true})} onJoined={async slug=>{await spaces.refetch();navigate(`/team/${slug}?view=settings`,{replace:true})}}/>}
          <WorkspaceScreen issueId={issueId} onLogout={()=>action.mutate("logout")}/>
        </TeamScope>
      ) : (
        <div className="team-content">
          {spaces.isPending ? (
            <Empty>{text("loading")}</Empty>
          ) : spaces.data?.length === 0 ? (
            <section className="team-welcome">
              <Users size={32} />
              <h1>{text("emptyTeamTitle")}</h1>
              <p>{text("emptyTeamHint")}</p>
              <Action primary onClick={() => setCreate(true)}>
                <Plus size={16} />
                {text("createWorkspace")}
              </Action>
            </section>
          ) : (
            <h1>{text("chooseWorkspace")}</h1>
          )}
          {!!spaces.data?.length && (
            <div className="team-workspace-grid">
              {spaces.data?.map((w) => (
                <button
                  className="team-workspace-card"
                  key={w.id}
                  onClick={() => navigate(`/team/${w.slug}`)}
                >
                  <span className="team-workspace-icon">
                    <Users size={22} />
                  </span>
                  <span className="team-workspace-info">
                    <strong>{w.name}</strong>
                    <span>{w.description || text(w.kind === "personal" ? "wb.personal" : "workspaceTeam")}</span>
                  </span>
                  <ArrowRight size={18} className="team-workspace-arrow" />
                </button>
              ))}
            </div>
          )}
          {!showInvitationNotifications && <div className="team-invitations">
            {invites.data
              ?.filter((i) => i.status === "pending")
              .map((i) => (
                <article className="team-invitation-card" key={i.id}>
                  <div>
                    <small>{text("invitation")}</small>
                    <h2>{i.workspace_name}</h2>
                  </div>
                  <Action
                    primary
                    disabled={accept.isPending}
                    onClick={() => accept.mutate(i)}
                  >
                    {text("acceptInvite")}
                  </Action>
                  {accept.variables?.id === i.id && <Failure error={accept.error} />}
                </article>
              ))}
          </div>}
        </div>
      )}
      {created && <Modal title="团队已创建" className="tm-create-dialog" onClose={()=>setCreated("")}>
        <div className="tm-dialog-body tm-create-success"><span className="tm-success-icon"><Check size={26}/></span>
          <h3>{workspace?.name}，准备就绪</h3><p>你是此团队的所有者，可以邀请伙伴、添加智能体，开始团队协作。</p>
          <div><span className="tm-avatar">{workspace?.avatar_url ? <img src={workspace.avatar_url} alt=""/> : workspace?.name.slice(0,1)}</span>
          <span><strong>{workspace?.name}</strong><small>1 位成员 · 所有者</small></span></div></div>
        <footer><Action onClick={()=>setCreated("")}>进入团队</Action>
        <Action primary onClick={()=>{navigate(`/team/${created}?view=settings&members=1`);setCreated("")}}><Plus size={15}/>邀请成员</Action></footer>
      </Modal>}
      {create && <Modal title="创建团队" className="tm-create-dialog" onClose={closeCreate}>
        <form id="mw-create-team" className="tm-dialog-body tm-create-form" onSubmit={event=>{event.preventDefault();if(!action.isPending && !reading && workspaceName.trim())action.mutate("create")}}>
          <div className="tm-intro"><h3>给团队一个共同的协作空间</h3><p>在这里管理团队任务、智能体和小队。</p></div>
          <WorkspaceAvatar value={avatar} name={workspaceName} onChange={setAvatar} reading={reading} setReading={setReading}/>
          <label className="tm-field"><span>团队名称 <b>*</b></span><input aria-label="团队名称" required maxLength={30} value={workspaceName} placeholder="例如：产品研发团队" onChange={e=>setWorkspaceName(e.target.value)}/><small>{workspaceName.length}/30</small></label>
          <label className="tm-field"><span>团队描述 <em>选填</em></span><textarea aria-label="团队描述" maxLength={200} rows={3} value={description} placeholder="简单介绍团队的目标与协作内容" onChange={e=>setDescription(e.target.value)}/></label>
          <Failure error={action.error}/><p className="tm-scope-note"><ShieldCheck size={15}/>原有 Work 任务和普通会话始终保留。</p>
        </form>
        <footer><Action onClick={closeCreate}>取消</Action><Action primary type="submit" form="mw-create-team" disabled={action.isPending || reading || !workspaceName.trim()}>创建团队</Action></footer>
      </Modal>}
    </div>
  );
}
function WorkspaceScreen({ issueId,onLogout }: { issueId?: string;onLogout:()=>void }) {
  const { workspace } = useTeam();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { entries, renderPage } = usePageAssembly();
  const view = params.get("view") || "workbench";
  const selected = issueId ? "tasks" : view;
  const fallback = selected === "inbox" && entries.has("tasks") ? "tasks" : "workbench";
  const tab = selected === "workbench" || selected === "projects" || selected === "rooms" || selected === "files" || entries.has(selected) ? selected : fallback;
  useEffect(() => {
    if (selected !== tab) navigate(`/team/${workspace.slug}?view=${tab}`, { replace: true });
  }, [selected, tab, workspace.slug, navigate]);
  return <WorkbenchShell onLogout={onLogout} view={issueId ? view : tab} issueId={issueId}>
    <main className="team-content">
      {tab === "files" ? <FilesPage/> : tab === "rooms" ? <RoomPage/> : tab === "projects" ? <ProjectsPage /> : entries.has(tab) && renderPage(tab, {
        issueId, onOpen: (id: string, commentId?: string) =>
          navigate(`/team/${workspace.slug}/issue/${id}${commentId ? `?comment=${encodeURIComponent(commentId)}` : ""}`),
      })}
    </main>
  </WorkbenchShell>;
}
export function TeamSignIn({onLogin}:{onLogin:(mode:"login"|"register",username:string,password:string)=>Promise<{ok:boolean;error?:string}>}) {
 return <LoginShell><PasswordLoginForm loginWithPassword={onLogin}/></LoginShell>;
}
