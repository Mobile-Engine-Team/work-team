import {useMessageAnchor} from "../team/locate-message";
import brandMark from "../../../../mloop/design-v3/welcome-brand-mark.svg?inline";
import workAvatar from "../../../../mloop/design-v3/ai-message-avatar.svg?inline";
import composerRobot from "./composer-robot.webp?inline";
import {mentionRecipients} from "./mention-recipients";
import {readAttachment} from "./composer-files";
import {NewTask,useTeamPeople} from "../team/tasks";
import {teamFetch} from "../team/request-transport";
import {teamServer} from "../team/client";
import {WorkspaceNavigation} from "./workspace-navigation";
import {SidebarResize,useSidebarWidth} from "./sidebar-resize";
import {PersonalSettings} from "../team/preferences";
import {WorkAction} from "./work-action";
import { WorkspaceSearch,WorkSuggestion } from "../team/work-tools";
import { usePageAssembly } from "../pages";
import { evidenceDestination } from "./evidence-presentation";
import { EvidenceDetails } from "./evidence-details";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign, KeyRound, Paperclip, X, Send, ChevronRight, PanelLeftClose, PanelLeftOpen, Search,
  MessageSquare,
  Pin as PinIcon,
  Plus, CirclePlus,
  Folder,
  ListTodo,
  Users,
  ArrowUp,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useTeam, text, teamApi } from "../team/client";
import { Action, Failure, Modal } from "../team/ui";
import {
  request,
  StateSchema,
  IDSchema,
  StatusSchema,
  WorkbenchAccessError,
  streamProgress,
  type Result,
  type Evidence,
} from "./api";
import { z } from "zod";
import "./workbench.css";
import { DynamicView, type LayoutStateChange } from "./dynamic-view";
import { AnswerOutcome, hasAnswerBody } from "./answer-outcome";
import { ResultSchema, type State } from "./schemas";

function WorkbenchTable({
  block,
  refs,
}: {
  block: Result["view"]["blocks"][number];
  refs: (ids: string[]) => ReactNode;
}) {
  const columns =
    block.columns?.length &&
    block.items.every((item) => item.cells?.length === block.columns?.length)
      ? block.columns
      : undefined;
  return (
    <div className="wb-table-scroll">
      <table>
        <thead>
          <tr>
            {columns ? (
              columns.map((column, i) => <th key={i}>{column}</th>)
            ) : (
              <>
                <th>{text("name")}</th>
                <th>{text("wb.details")}</th>
              </>
            )}
            <th>{text("wb.evidence")}</th>
          </tr>
        </thead>
        <tbody>
          {block.items.map((item, i) => (
            <tr key={i}>
              {columns ? (
                item.cells?.map((cell, j) => <td key={j}>{cell}</td>)
              ) : (
                <>
                  <td>
                    {item.title}
                    {item.group && <small>{item.group}</small>}
                  </td>
                  <td>
                    {item.value && <strong>{item.value}</strong>}
                    {item.text}
                  </td>
                </>
              )}
              <td>{refs(item.evidenceIds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function View({
  result,
  generating = false,
  onEvidence,
  onEntity,
  onFollowUp,
  onStateChange,
}: {
  result: Result;
  generating?: boolean;
  onEvidence: (e: Evidence) => void;
  onEntity: (e: Evidence) => void;
  onFollowUp: (s: string) => void;
  onStateChange?: LayoutStateChange;
}) {
  if (result.dynamic)
    return (
      <DynamicView
        result={result}
        generating={generating}
        onEvidence={onEvidence}
        onEntity={onEntity}
        onStateChange={onStateChange}
        onFollowUp={onFollowUp}
      />
    );
  const refs = (ids: string[]) =>
    ids.map((id) => {
      const e = result.evidence.find((x) => x.id === id);
      return e ? (
        <button
          className="wb-evidence-link"
          key={id}
          onClick={() => onEvidence(e)}
        >
          {e.title || e.kind}
          <ExternalLink size={11} />
        </button>
      ) : null;
    });
  return (
    <div className="wb-result">
      <header>
        <h2>{result.view.title}</h2>
        <small>
          {text("wb.snapshot")} ·{" "}
          {new Date(result.generatedAt).toLocaleString()}
        </small>
      </header>
      <div className="wb-blocks">
        {result.view.blocks.map((block, index) => (
          <section key={index} className={`wb-block wb-${block.type}`}>
            <h3>{block.title}</h3>
            {block.text && <p>{block.text}</p>}
            {block.type === "table" ? (
              <WorkbenchTable block={block} refs={refs} />
            ) : (
              <div className="wb-items">
                {block.items.map((item, i) => (
                  <article key={i}>
                    {item.group && (
                      <small className="wb-group">{item.group}</small>
                    )}
                    {item.value && (
                      <strong className="wb-value">{item.value}</strong>
                    )}
                    <h4>{item.title}</h4>
                    {item.text && <p>{item.text}</p>}
                    <div className="wb-refs">{refs(item.evidenceIds)}</div>
                  </article>
                ))}
              </div>
            )}
            <div className="wb-refs">{refs(block.evidenceIds)}</div>
          </section>
        ))}
      </div>
      {result.view.limitations.length > 0 && (
        <aside className="wb-limitations">
          <strong>{text("wb.limitations")}</strong>
          {result.view.limitations.map((item, i) => (
            <p key={i}>{item}</p>
          ))}
        </aside>
      )}
    </div>
  );
}

export function WorkbenchShell({
  children,
  onLogout,
  view,
  issueId,
}: {
  children: ReactNode;
  onLogout:()=>void;
  view: string;
  issueId?: string;
}) {
  const { workspace, user } = useTeam();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const client = useQueryClient();
  const { entries } = usePageAssembly();
  const conversation = params.get("conversation") || "";
  const pinID = params.get("pin") || "";
  const sourcePin = params.get("sourcePin") || "";
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [progress, setProgress] = useState("");
  const [revokedAt, setRevokedAt] = useState(0);
  const layoutStates = useRef<
    Record<string, Record<string, Record<string, unknown>>>
  >({});
  const rail=useSidebarWidth("left","work-team");
  useLayoutEffect(()=>{
    const root=document.querySelector<HTMLElement>(".team-root");
    if(rail.width) root?.style.setProperty("--rail",rail.width+"px");
    return ()=>{root?.style.removeProperty("--rail");};
  },[rail.width]);
  const [collapsed,setCollapsed]=useState(()=>window.innerWidth<=760);
  const wideCollapsed=useRef(false);
  useEffect(()=>{
    const compact=window.matchMedia("(max-width: 760px)");
    const adapt=()=>setCollapsed(compact.matches || wideCollapsed.current);
    compact.addEventListener("change",adapt);
    return ()=>compact.removeEventListener("change",adapt);
  },[]);
  const [accountMenu,setAccountMenu]=useState(false),[prefs,setPrefs]=useState("");
  const accountEntry=useRef<HTMLButtonElement>(null);
  const accountPopup=useRef<HTMLElement>(null);
  useEffect(()=>{
    if(!accountMenu) return;
    function dismiss(event:PointerEvent){if(!accountPopup.current?.contains(event.target as Node))setAccountMenu(false)}
    function keyboard(event:KeyboardEvent){if(event.key==="Escape"){setAccountMenu(false);accountEntry.current?.focus()}}
    document.addEventListener("pointerdown",dismiss);
    document.addEventListener("keydown",keyboard);
    return ()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",keyboard)};
  },[accountMenu]);
  const people=useTeamPeople();
  const [partners,setPartners]=useState(false);
  const [attachmentError,setAttachmentError]=useState("");
  const [uploads,setUploads]=useState<{file:File;key:string}[]>([]);
  const selectFiles=useRef<HTMLInputElement>(null);
  function addFiles(files:File[]){
    if(files.length+uploads.length>4 || files.some(f=>f.size>3*1024*1024)){
      setAttachmentError("每条消息最多四个附件，单个附件上限 3 MB");return;
    }
    setAttachmentError("");
    setUploads(previous=>[...previous,...files.map(file=>({file,key:crypto.randomUUID()}))]);
  }
  const scope = `${user.id}:${workspace.id}`;
  useEffect(() => {
    layoutStates.current = {};
  }, [scope, revokedAt]);
  const draftKey = `mobilework.workbench.draft:${scope}:${conversation || "new"}`;
  const [draft, setDraft] = useState(
    () => sessionStorage.getItem(draftKey) || "",
  );
  const composerInput = useRef<HTMLTextAreaElement>(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [canExpandComposer, setCanExpandComposer] = useState(false);
  useLayoutEffect(() => {
    const input = composerInput.current;
    if (!input) return;
    const resize = () => {
      const normalLimit = Math.min(180, window.innerHeight * 0.25);
      const limit = composerExpanded ? Math.min(420, window.innerHeight * 0.45) : normalLimit;
      input.style.height = "0px";
      const fullHeight = input.scrollHeight;
      input.style.height = `${Math.max(64, Math.min(fullHeight, limit))}px`;
      setCanExpandComposer(fullHeight > normalLimit);
    };
    resize();
    let width = input.clientWidth;
    const observer = new ResizeObserver(() => {
      if (input.clientWidth !== width) { width = input.clientWidth; resize(); }
    });
    observer.observe(input);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [draft, composerExpanded, view, pinID]);
  useEffect(() => { setComposerExpanded(false); }, [draftKey]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setDraft(sessionStorage.getItem(draftKey) || "");
    setUploads([]);setAttachmentError("");setPartners(false);
  }, [draftKey]);
  const queryKey = ["team", workspace.id, "workbench", user.id, conversation];
  const state = useQuery({
    queryKey,
    queryFn: () =>
      request(
        workspace.id,
        conversation ? `?conversation=${conversation}` : "",
        StateSchema,
      ),
    refetchInterval: (q) =>
      q.state.data?.runtimeStatus === "warming" ||
      q.state.data?.runtimeStatus === "unavailable" ||
      q.state.data?.messages.some((m) => m.status === "running") ||
      q.state.data?.pins.some((p) => p.status === "refreshing")
        ? 1500
        : 15000,
  });
  const data =
    state.error instanceof WorkbenchAccessError ||
    state.dataUpdatedAt <= revokedAt
      ? undefined
      : state.data;
  useEffect(() => {
    if (!(state.error instanceof WorkbenchAccessError)) return;
    layoutStates.current = {};
    layoutStates.current = {};
    setEvidence(null);
    client.removeQueries({
      queryKey: ["team", workspace.id, "workbench", user.id],
      predicate: (q) => q.queryKey[4] !== conversation,
    });
    // Drop the active query's cached private payload while retaining its access error.
    const query = client.getQueryCache().find({ queryKey, exact: true });
    if (query?.state.data !== undefined) query.setState({ data: undefined });
  }, [state.error, workspace.id, user.id, conversation, client]);
  useEffect(() => {
    if (
      !data?.messages.some((m) => m.status === "unavailable") &&
      !data?.pins.some((p) => p.status === "unavailable")
    )
      return;
    layoutStates.current = {};
    setEvidence(null);
    client.removeQueries({
      queryKey: ["team", workspace.id, "workbench", user.id],
      predicate: (q) => q.queryKey[4] !== conversation,
    });
  }, [state.dataUpdatedAt, workspace.id, user.id, conversation, client]);
  const pin = data?.pins.find((p) => p.id === pinID);
  const [pinRevision, setPinRevision] = useState<number | null>(null);
  useEffect(() => setPinRevision(null), [pinID, scope]);
  const history = useQuery({
    queryKey: ["team", workspace.id, "pinVersions", user.id, pinID, pin?.revision],
    enabled: Boolean(pin && data),
    queryFn: () => request(workspace.id, "/pins/" + pinID + "/versions", z.array(z.object({revision: z.number(), result: ResultSchema}))),
  });
  const pinResult = pinRevision === null ? pin?.result : history.data?.find(entry => entry.revision === pinRevision)?.result;
  const targetMessage = params.get("message");
  useMessageAnchor("work-message-", targetMessage, !!data?.messages.some(m=>m.id===targetMessage));
  const active = data?.messages.find((m) => m.status === "running");
  const runtimeNotice = data?.modelReady ? "" : text(
    data?.runtimeStatus === "warming" ? "wb.warming" :
    data?.runtimeStatus === "unavailable" ? "wb.recovering" : "wb.noModel",
  );
  const refreshState = () =>
    client.invalidateQueries({
      queryKey: ["team", workspace.id, "workbench", user.id],
    });
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void streamProgress(
      workspace.id,
      active.id,
      controller.signal,
      setProgress,
      (message) =>
        client.setQueryData<State>(queryKey, (previous) => {
          if (!previous) return previous;
          return {
            ...previous,
            messages: previous.messages.map((old) =>
              old.id === message.id &&
              (message.result?.dynamic?.seq || 0) >=
                (old.result?.dynamic?.seq || 0)
                ? message
                : old,
            ),
          };
        }),
    ).catch((error) => {
      if (error instanceof WorkbenchAccessError) {
        setRevokedAt(Date.now());
        client.setQueryData<State>(queryKey, (previous) =>
          previous ? { ...previous, messages: [], pins: [] } : previous,
        );
        client.removeQueries({
          queryKey: ["team", workspace.id, "workbench", user.id],
        });
        setEvidence(null);
        void refreshState();
      }
    });
    return () => {
      controller.abort();
      setProgress("");
    };
  }, [active?.id, workspace.id]);
  const send = useMutation({
    mutationFn: async (retry?: {id:string;prompt:string;files?:{id:string;filename:string}[]}) => {
      const retryPrompt=retry?.prompt;
      const files=retry ? await Promise.all((retry.files || []).map(async f=>{
        const response=await teamFetch(teamServer+"/api/workbench/input-files/"+f.id,{headers:{"X-Workspace-ID":workspace.id}});
        if(!response.ok)throw Error("原消息附件不可访问");
        return readAttachment(await response.blob(),f.filename);
      })) : await Promise.all(uploads.map(({file})=>readAttachment(file,file.name)));
      const inputKey=retry?.id || uploads.map(f=>f.key).join(",");
      const prompt = (retryPrompt ?? draft).trim() || files.map(f=>f.filename).join("、");
      if (!prompt || !data) return;
      const pendingKey = `mobilework.workbench.pending:${scope}:${conversation || "new"}`;
      const cached = z
        .object({
          requestId: z.string(),
          conversationId: z.string(),
          prompt: z.string(),
          inputKey:z.string().optional(),
        })
        .safeParse(JSON.parse(sessionStorage.getItem(pendingKey) || "null"));
      if(!conversation && /(^|\s)@[^\s@]/u.test(prompt)){
        const members=await teamApi.listMembers(workspace.id);
        const mentioned=mentionRecipients(prompt,members,user.id);
        if(mentioned.length){
          const key=cached.success&&cached.data.prompt===prompt&&(cached.data.inputKey||"")===inputKey?cached.data.requestId:crypto.randomUUID();
          sessionStorage.setItem(pendingKey,JSON.stringify({requestId:key,conversationId:"",prompt,inputKey}));
          const room=await request(workspace.id,"/rooms",IDSchema,{kind:mentioned.length===1?"direct":"group",members:mentioned.map(m=>m.user_id),title:mentioned.map(m=>m.name||m.email).join("、").slice(0,100),request_id:key,content:prompt,files});
          sessionStorage.removeItem(pendingKey);sessionStorage.removeItem(draftKey);setDraft("");setParams({view:"rooms",room:room.id});return;
        }
        if(!prompt.includes("@Work"))throw Error("请选择当前工作区中可见的成员。");
      }
      let id = conversation;
      if (
        !id &&
        cached.success &&
        cached.data.prompt === prompt && (cached.data.inputKey||"")===inputKey
      )
        id = cached.data.conversationId;
      if (!id) {
        const c = await request(workspace.id, "/conversations", IDSchema, {
          title: prompt.slice(0, 80),
        });
        id = c.id;
      }
      const requestId =
        cached.success &&
        cached.data.prompt === prompt && (cached.data.inputKey||"")===inputKey
          ? cached.data.requestId
          : crypto.randomUUID();
      sessionStorage.setItem(
        pendingKey,
        JSON.stringify({ requestId, conversationId: id, prompt,inputKey }),
      );
      const latest = data?.messages
        .filter((m) => m.status === "completed")
        .at(-1);
      await request(workspace.id, "/messages", IDSchema, {
        requestId,
        conversationId: id,
        prompt,
        files,
        sourcePinId: latest ? undefined : sourcePin || undefined,
        layoutState:
          layoutStates.current[
            latest ? `message:${latest.id}` : `pin:${sourcePin}`
          ],
      });
      sessionStorage.removeItem(pendingKey);
      if (retryPrompt === undefined) sessionStorage.removeItem(draftKey);
      if (mounted.current) {
        if (retryPrompt === undefined) {setDraft("");setUploads([]);setPartners(false)}
        setParams({
          view: "workbench",
          conversation: id,
          ...(sourcePin ? { sourcePin } : {}),
        });
      }
      await refreshState();
    },
  });
  const pinAction = useMutation({
    mutationFn: async ({
      messageId,
      replace = false,
    }: {
      messageId: string;
      replace?: boolean;
    }) => {
      const original = replace
        ? data?.pins.find((p) => p.id === sourcePin)
        : undefined;
      const saved = await request(
        workspace.id,
        original ? `/pins/${original.id}` : "/pins",
        IDSchema,
        { messageId, ...(original ? { revision: original.revision } : {}) },
        original ? "PUT" : "POST",
      );
      await refreshState();
      if (mounted.current) setParams({ view: "workbench", pin: saved.id });
    },
  });
  const refresh = useMutation({
    mutationFn: async ({id,force=false}:{id:string;force?:boolean}) => {
      const response = await request(workspace.id, `/pins/${id}/refresh${force?"?force=1":""}`, StatusSchema, {});
      await refreshState();
      return { id, status: response.status };
    },
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await request(
        workspace.id,
        `/pins/${id}`,
        z.object({ ok: z.boolean() }),
        undefined,
        "DELETE",
      );
      if (mounted.current) setParams({ view: "workbench" });
      await refreshState();
    },
  });
  const cancelRun = useMutation({
    mutationFn: async (id: string) => {
      await request(workspace.id, `/messages/${id}/cancel`, StatusSchema, {});
      await refreshState();
    },
  });
  const prefill = (value: string) => {
    setDraft(value);
    sessionStorage.setItem(draftKey, value);
  };
  const attempted = useRef(new Set<string>());
  const refreshBudget = useRef({ pin: "", count: 0, last: 0 });
  useEffect(() => {
    if (
      !pin ||
      !data ||
      pin.status === "refreshing" ||
      !data?.modelReady ||
      pin.result?.fingerprint === pin.refreshKey
    )
      return;
    if (refreshBudget.current.pin !== pin.id)
      refreshBudget.current = { pin: pin.id, count: 0, last: 0 };
    if (
      refreshBudget.current.count >= 2 ||
      Date.now() - refreshBudget.current.last < 30000
    )
      return;
    const key = `${pin.id}:${pin.refreshKey}`;
    if (attempted.current.has(key)) return;
    attempted.current.add(key);
    refreshBudget.current.count++;
    refreshBudget.current.last = Date.now();
    refresh.mutate({id:pin.id});
  }, [pin?.id, pin?.status, pin?.result?.fingerprint, pin?.refreshKey, data?.modelReady]);
  const to = (query: Record<string, string>) =>
    navigate(`/team/${workspace.slug}?${new URLSearchParams(query)}`);
  const returnQuery: Record<string, string> = conversation
    ? { view: "workbench", conversation, ...(sourcePin ? { sourcePin } : {}) }
    : pinID
      ? { view: "workbench", pin: pinID }
      : { view: "workbench" };
  const openEvidence = (e: Evidence) => {
    setEvidence(null);
    const back = new URLSearchParams(returnQuery).toString();
    const destination = evidenceDestination(e);
    if (destination === "topic" && e.topicId)
      to({
        view: "projects",
        project: e.projectId,
        section: "overview",
        return: back,
        ...(e.kind === "comment" ? { comment: e.objectId } : {}),
      });
    else if (destination === "issue")
      navigate(
        `/team/${workspace.slug}/issue/${e.issueId}?${new URLSearchParams({ return: back, ...(e.kind === "comment" ? { comment: e.objectId } : {}) })}`,
      );
    else if (destination === "project")
      to({ view: "projects", project: e.projectId, return: back });
  };
  const showing = view === "workbench" && !issueId;
  const counts = data?.catalog.counts;
  const recommendations =
    counts && counts.issue > 0
      ? [text("wb.question1"), text("wb.question2"), text("wb.question3")]
      : [text("wb.emptyQuestion")];
  const home=showing && !pinID && !conversation && params.get("from")!=="agent";
  const canSend=!!(draft.trim() || uploads.length) && !!data && !send.isPending && !active;
  const suggest=()=>{prefill(recommendations[0]);composerInput.current?.focus()};
  const openPartner=useMutation({mutationFn:async ({kind,id,label}:{kind:"agent"|"squad"|"member";id:string;label:string})=>{
    if(kind==="member"){prefill(draft.replace(/@$/,"")+"@"+label+" ");composerInput.current?.focus()}
    else if(kind==="squad"){const room=await request(workspace.id,"/squad-room/"+id,IDSchema,{});to({view:"rooms",room:room.id})}
    else {const session=await teamApi.createChatSession({agent_id:id,title:label},workspace.slug);to({view:"agent-chat",chat:session.id})}
    setPartners(false);
  }});
  return (
    <div className={"wb-shell"+(collapsed?" rail-collapsed":"")}>
      <div className="v3-rail-tools">
        <button aria-label="搜索会话与任务" onClick={()=>window.dispatchEvent(new Event("mw:search"))}><Search size={14}/></button>
        <button aria-label={collapsed?"展开侧栏":"收起侧栏"} onClick={()=>{if(window.innerWidth>760)wideCollapsed.current=!collapsed;setCollapsed(!collapsed)}}>{collapsed?<PanelLeftOpen size={14}/>:<PanelLeftClose size={14}/>}</button>
      </div>
      <PersonalSettings onLogout={onLogout} open={!!prefs} initialTab={prefs} close={()=>setPrefs("")}/><WorkSuggestion key={workspace.id+user.id}/><WorkspaceSearch/>
      <aside className="wb-sidebar" id="mw-workspace-sidebar">
        <SidebarResize side="left" controls="mw-workspace-sidebar" setWidth={rail.setWidth} save={rail.save}/>
        <button aria-label="新建" className="wb-new" onClick={() => to({ view: "workbench" })}>
          <CirclePlus size={18} />
          新建
        </button>
        <WorkspaceNavigation key={workspace.id+user.id} view={view} issueId={issueId} showTasks={entries.has("tasks")} show={entry=>entries.has(entry)} pins={data?.pins||[]}/>
        <footer ref={accountPopup}><button ref={accountEntry} onClick={()=>setAccountMenu(!accountMenu)} aria-label="账户菜单" aria-expanded={accountMenu}><i>{user.name.slice(0,1)}</i><span>{user.name}</span><ChevronRight size={14}/></button>
          {accountMenu&&<div className="mw-account-menu"><strong>{user.name}</strong><small>{user.email}</small><button onClick={()=>{setPrefs("账户管理");setAccountMenu(false)}}>设置</button><button onClick={()=>{setPrefs("帮助与反馈");setAccountMenu(false)}}>帮助与反馈</button><button onClick={()=>{to({view:"runtime"});setAccountMenu(false)}}>运行时</button><button onClick={onLogout}>退出账号</button></div>}
        </footer>
      </aside>
      <main className={"wb-main"+(home?" wb-home":"")}>
        {!showing ? (
          <>
            {params.get("return") && (
              <Action
                onClick={() =>
                  navigate(`/team/${workspace.slug}?${params.get("return")}`)
                }
              >
                <ArrowLeft size={15} />
                {text("wb.back")}
              </Action>
            )}
            {children}
          </>
        ) : home && params.get("compose")==="task" ? (
          <div className="wb-home-task-wrap">
            <section className="wb-welcome"><div className="wb-home-title"><img src={brandMark} alt="Work"/><h1>Mobile熠动，Work智简</h1></div><p>一个人的灵感，一群人的成果。</p></section>
            <NewTask inline onClose={()=>to({view:"workbench"})} onCreated={id=>navigate("/team/"+workspace.slug+"/issue/"+id)}/>
          </div>
        ) : (
          <>
            <div className="wb-chat-content">
              <Failure
                error={
                  state.error ||
                  send.error ||
                  pinAction.error ||
                  refresh.error ||
                  remove.error
                }
              />
              {!data && state.isPending && <p>{text("loading")}</p>}
              {pin ? (
                <>
                  <div className="wb-pin-toolbar">
                    <span>
                      <PinIcon size={16} />
                      {text("wb.liveView")}
                    </span>
                    <Action
                      disabled={
                        pin.status === "refreshing" || refresh.isPending || !data?.modelReady
                      }
                      onClick={() => refresh.mutate({id:pin.id,force:true})}
                    >
                      <RefreshCw size={15} />
                      {text(pin.status === "refreshing" || refresh.isPending ? "wb.refreshBusy" : "wb.refresh")}
                    </Action>
                    <Action
                      onClick={() => {
                        setDraft(pin.intent);
                        sessionStorage.setItem(draftKey, pin.intent);
                        setParams({ view: "workbench", sourcePin: pin.id });
                      }}
                    >
                      {text("wb.adjust")}
                    </Action>
                    <label>版本 <select aria-label="视图版本" value={pinRevision ?? ""} onChange={e=>setPinRevision(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">当前版本</option>{history.data?.map(v=><option key={v.revision} value={v.revision}>V{v.revision}</option>)}
                    </select></label><Failure error={history.error}/>
                    <Action onClick={() => remove.mutate(pin.id)}>
                      <Trash2 size={15} />
                      {text("wb.unpin")}
                    </Action>
                  </div>
                  {runtimeNotice && <p role="status">{runtimeNotice}</p>}
                  {pin.status === "refreshing" && (
                    <p className="wb-progress">{text("wb.refreshing")}</p>
                  )}
                  {pin.status !== "refreshing" && pin.error && <p role="alert" className="wb-answer-failure">{text("wb.refreshFailed")}</p>}
                  {pin.status === "ready" && pin.result?.fingerprint === pin.refreshKey && refresh.data?.id === pin.id && refresh.data.status === "ready" && !refresh.isPending && <p role="status">{text("wb.upToDate")}</p>}
                  {pinResult && (
                    <View
                      key={`pin:${pin.id}:${pinRevision}`}
                      result={pinResult}
                      onStateChange={(id, state) => {
                        const key = `pin:${pin.id}`;
                        layoutStates.current[key] = {
                          ...layoutStates.current[key],
                          [id]: state,
                        };
                      }}
                      onEvidence={setEvidence}
                      onEntity={openEvidence}
                      onFollowUp={prefill}
                    />
                  )}
                </>
              ) : pinID ? (
                data && <section className="team-welcome"><h2>这个视图已取消固定或不可访问</h2><Action onClick={()=>to({view:"workbench"})}>返回首页</Action></section>
              ) : conversation ? (
                <div className="wb-messages">
                  {data?.messages.map((m) => (
                    <section key={m.id} id={"work-message-"+m.id}>
                      <div className="wb-question">{m.prompt}{m.files?.map(f=><button key={f.id} onClick={()=>to({view:"files",file:f.id})}><Paperclip size={14}/>{f.filename}</button>)}</div>
                      {m.status === "running" && (
                        <div className="wb-progress">
                          {progress || m.progress || text("wb.working")}{" "}
                          <Action onClick={() => cancelRun.mutate(m.id)}>
                            {text("wb.cancel")}
                          </Action>
                        </div>
                      )}
                      <AnswerOutcome
                        failed={m.status !== "running" && m.status !== "completed"}
                        hasBody={hasAnswerBody(m.result)}
                        notice={text(m.status === "cancelled" ? "wb.answerStopped" : m.status === "interrupted" ? "wb.answerInterrupted" : hasAnswerBody(m.result) ? "wb.answerPartial" : "wb.answerFailed")}
                        retryLabel={text("wb.answerRetry")}
                        retryDisabled={send.isPending || !!active || !data?.modelReady}
                        onRetry={() => send.mutate(m)}
                      >
                      {m.result && (
                        <>
                          <View
                            key={`message:${m.id}`}
                            result={m.result}
                            generating={m.status === "running"}
                            onStateChange={(id, state) => {
                              const key = `message:${m.id}`;
                              layoutStates.current[key] = {
                                ...layoutStates.current[key],
                                [id]: state,
                              };
                            }}
                            onEvidence={setEvidence}
                      onEntity={openEvidence}
                            onFollowUp={prefill}
                          />
                          {m.status==="completed" && m.result?.action && <WorkAction kind={m.result.action} message={m.id} prompt={m.prompt}/>}
                          {m.status === "completed" && !m.result?.action && <Action
                            disabled={pinAction.isPending}
                            onClick={() =>
                              pinAction.mutate({ messageId: m.id })
                            }
                          >
                            <PinIcon size={15} />
                            {text("wb.pin")}
                          </Action>}
                          {sourcePin && m.status === "completed" && (
                            <Action
                              disabled={
                                pinAction.isPending || m.status !== "completed"
                              }
                              onClick={() =>
                                pinAction.mutate({
                                  messageId: m.id,
                                  replace: true,
                                })
                              }
                            >
                              {text("wb.replacePin")}
                            </Action>
                          )}
                        </>
                      )}
                      </AnswerOutcome>
                    </section>
                  ))}
                </div>
              ) : params.get("from")==="agent" ? <section className="wb-messages"><h1>Work</h1></section> : (
                <section className="wb-welcome">
                  <div className="wb-home-title"><img src={brandMark} alt="Work"/><h1>Mobile熠动，Work智简</h1></div>
                  <p>一个人的灵感，一群人的成果。</p>
                </section>
              )}
            </div>
            {!pinID && (
              <form
                className="wb-composer"
                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{e.preventDefault();addFiles(Array.from(e.dataTransfer.files))}}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSend) send.mutate(undefined);
                }}
              >
                {home&&<><img className="wb-home-robot" src={composerRobot} alt=""/><div className="wb-home-tabs"><button type="button" aria-pressed="true" onClick={()=>composerInput.current?.focus()}><MessageSquare size={15}/>会话</button><button type="button" onClick={()=>to({view:"workbench",compose:"task"})}><ListTodo size={15}/>任务</button></div></>}
                <input type="file" multiple hidden ref={selectFiles} aria-label="添加会话附件" onChange={e=>{addFiles(Array.from(e.target.files||[]));e.target.value=""}}/>
                {attachmentError&&<p role="alert">{attachmentError}</p>}
                {uploads.length>0 && <div className="wb-input-files">{uploads.map(f=><button type="button" key={f.key} onClick={()=>setUploads(uploads.filter(row=>row.key!==f.key))} aria-label={"移除 "+f.file.name}><Paperclip size={13}/>{f.file.name}<X size={13}/></button>)}</div>}
                <textarea
                  ref={composerInput}
                  aria-label={text("wb.placeholder")}
                  value={draft}
                  placeholder={home ? "可以试试："+recommendations[0] : text("wb.placeholder")}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if(home && e.target.value.endsWith("@"))setPartners(true);
                    sessionStorage.setItem(draftKey, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if(home && !draft && e.key==="ArrowRight"){e.preventDefault();suggest();return}
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      if (canSend)
                        send.mutate(undefined);
                    }
                  }}
                />

                {(canExpandComposer || composerExpanded) && (
                  <button type="button" className="wb-composer-expand"
                    aria-expanded={composerExpanded}
                    onClick={() => setComposerExpanded((previous) => !previous)}>
                    {text(composerExpanded ? "wb.collapseInput" : "wb.expandInput")}
                  </button>
                )}
                <div className="wb-composer-actions">
                  <button type="button" aria-label="选择附件" onClick={()=>selectFiles.current?.click()}><Plus size={17}/></button>
                  {home&&<button type="button" aria-label="选择伙伴" aria-expanded={partners} onClick={()=>setPartners(!partners)}><AtSign size={17}/></button>}
                  {home&&!draft&&<button type="button" className="wb-fill" onClick={suggest}>填入建议</button>}
                  <button className="wb-send" aria-label={text("wb.send")} disabled={!canSend}><Send size={15}/></button>
                </div>
                {partners&&<div className="wb-partners"><strong>选择伙伴</strong>
                  <button type="button" onClick={()=>{prefill(draft.replace(/@$/,"")+"@Work ");setPartners(false);composerInput.current?.focus()}}>Work</button>
                  {people.members.data?.filter(m=>m.user_id!==user.id).map(m=><button type="button" key={m.id} onClick={()=>openPartner.mutate({kind:"member",id:m.user_id,label:m.email||m.name})}>{m.name||m.email} · 成员</button>)}
                  {people.agents.data?.filter(a=>!a.archived_at && a.system_key!=="mobilework" && people.allowed(a)).map(a=><button type="button" key={a.id} disabled={openPartner.isPending} onClick={()=>openPartner.mutate({kind:"agent",id:a.id,label:a.name})}>{a.name} · 智能体</button>)}
                  {people.squads.data?.filter(people.allowedSquad).map(s=><button type="button" key={s.id} disabled={openPartner.isPending} onClick={()=>openPartner.mutate({kind:"squad",id:s.id,label:s.name})}>{s.name} · 小队</button>)}
                  <Failure error={openPartner.error||people.members.error||people.agents.error||people.squads.error}/>
                </div>}
                <div className="wb-composer-scope"><span><Folder size={14}/>当前协作空间</span><span><KeyRound size={13}/>默认权限</span>
                <small role="status">{runtimeNotice || (data?.mock ? "Work · Mock 模型适配器" : "")}</small></div>
              </form>
            )}
            {home&&<div className="wb-home-guides"><span><img src={workAvatar} alt=""/>直接提问，与 Work 一起工作</span><i/><button onClick={()=>setPartners(!partners)}><Users size={15}/>@ 伙伴，开始协作<ChevronRight size={13}/></button></div>}
          </>
        )}
      </main>
      {evidence &&
        data &&
        [...data.messages, ...data.pins].some((item) =>
          item.result?.evidence.some((ref) => ref.id === evidence.id),
        ) && (
          <Modal title={text("wb.evidence")} onClose={() => setEvidence(null)}>
            <EvidenceDetails key={evidence.id} evidence={evidence} onOpen={() => openEvidence(evidence)} />
          </Modal>
        )}
    </div>
  );
}
