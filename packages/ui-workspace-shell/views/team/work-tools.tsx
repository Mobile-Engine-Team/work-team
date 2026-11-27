import { AtSign, ChevronDown, Folder, ListTodo, Plus, Sparkles, X, Send } from "../icons";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { KeyRound, Paperclip } from "lucide-react";
import { readAttachment } from "../workbench/composer-files";
import { request } from "../workbench/api";
import {
  teamApi,
  useTeam,
  useTeamAction,
  useTeamQuery,
} from "./client";
import { Action, Empty, Failure, Input, Modal, Textarea } from "./ui";

export function SidePanel({
  ws,
  firstPrompt="",
  issue,
  kind,
  id,
  close,
}: {
  ws: string;
  firstPrompt?:string;
  issue?: { identifier: string; title: string };
  kind: string;
  id: string;
  close: () => void;
}) {
  const seeded=useRef(false), upload=useRef<HTMLInputElement>(null);
  const [files,setFiles]=useState<File[]>([]);
  const [fileError,setFileError]=useState("");
  const [mentions,setMentions]=useState(false);
  const [project,setProject]=useState(""), [permission,setPermission]=useState("default");
  const projects=useTeamQuery(["projects"],()=>teamApi.listProjects());
  const pickFiles=(added: File[])=>{
    if(files.length+added.length>4) {setFileError("每条消息最多四个附件");return;}
    if(added.some(file=>file.size>3*1024*1024)) {setFileError("单个附件不能超过 3 MB");return;}
    setFileError("");setFiles(previous=>[...previous,...added]);
  };
  const download=(file:File)=>{
    const link=document.createElement("a");
    link.href=URL.createObjectURL(file);link.download=file.name;link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1000);
  };
  const [prompt, setPrompt] = useState(firstPrompt),
    [messages, setMessages] = useState<{ q: string; a: string; files: File[] }[]>([]);
  const send = useTeamAction(async () => {
    const inputs=await Promise.all(files.map(file=>readAttachment(file,file.name)));
    const question=prompt.trim() || files.map(file=>file.name).join("、");
    const result = await request(
      ws,
      "/side-work",
      z.object({ answer: z.string() }),
      { kind, id, prompt, project_id:project, permission, files:inputs, history: messages.slice(-8).map(({q,a}) => ({question:q,answer:Array.from(a).slice(-4000).join("")})) },
    );
    setMessages((previous) => [...previous, { q: question, a: result.answer, files }]);
    setFiles([]);setFileError("");setMentions(false);setPrompt("");
  });
  useEffect(()=>{if(firstPrompt && !seeded.current){seeded.current=true;send.mutate()}},[firstPrompt,send.mutate]);
  return (
    <aside className="v3-side-chat" role="dialog" aria-label="临时 Work 会话">
      <header>
        <h3>Work 临时聊天</h3>
        <Action aria-label="关闭" onClick={close}><X size={15}/></Action>
      </header>
      {issue && <div className="v3-side-context"><ListTodo size={15}/><span><small>当前任务 · {issue.identifier}</small><strong>{issue.title}</strong></span></div>}
      <div className="v3-side-messages">{!issue && <p>关闭后清空本次讨论。</p>}
      {messages.map((m, i) => (
        <article key={i}>
          <strong>{m.q}</strong>
          {m.files.map((file,index)=><button className="v3-side-file" key={index} onClick={()=>download(file)}><Paperclip size={13}/>{file.name}</button>)}
          <p>{m.a}</p>
        </article>
      ))}
      </div>
      <div className="v3-side-input">
        <div className="v3-side-composer">
          {files.length>0 && <div className="v3-side-files">{files.map((file,index)=>
            <button key={index} className="v3-side-file" disabled={send.isPending} aria-label={"移除 "+file.name}
              onClick={()=>{setFiles(previous=>previous.filter((_,i)=>i!==index));setFileError("");}}><Paperclip size={13}/>{file.name}<X size={12}/></button>)}</div>}
          <Textarea aria-label="临时会话消息" value={prompt} disabled={send.isPending}
            placeholder="今天帮你做些什么？ @ 邀请伙伴" maxLength={8000}
            onChange={e=>{setPrompt(e.target.value);setMentions(e.target.value.endsWith("@"));}}
            onKeyDown={e=>{
              if(e.key==="Escape" && mentions){e.stopPropagation();setMentions(false);}
              if(e.key==="Enter" && !e.shiftKey && !e.nativeEvent.isComposing){
                e.preventDefault(); if((prompt.trim()||files.length) && !send.isPending) send.mutate();
              }
            }}/>
          <div className="v3-side-actions">
            <input type="file" ref={upload} multiple hidden aria-label="选择临时附件"
              onChange={e=>{pickFiles(Array.from(e.target.files||[]));e.target.value="";}}/>
            <button aria-label="添加附件" disabled={send.isPending} onClick={()=>upload.current?.click()}><Plus size={18}/></button>
            <button aria-label="提及协作者" aria-expanded={mentions} disabled={send.isPending} onClick={()=>setMentions(!mentions)}><AtSign size={16}/></button>
            {mentions && <div className="v3-side-mentions" role="status">临时会话仅限你与 Work 讨论<button aria-label="收起候选" onClick={()=>setMentions(false)}><X size={13}/></button></div>}
            <button className="v3-side-send" aria-label="发送" disabled={(!prompt.trim()&&!files.length)||send.isPending} onClick={()=>send.mutate()}><Send size={16}/></button>
          </div>
          <div className="v3-side-scope">
            <label><Folder size={14}/><span>{projects.data?.projects.find(p=>p.id===project)?.title || "当前协作空间"}</span><ChevronDown size={12}/>
              <select aria-label="工作空间" value={project} disabled={send.isPending} onChange={e=>setProject(e.target.value)}>
                <option value="">当前协作空间</option>{projects.data?.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
              </select></label>
            <label><KeyRound size={14}/><span>{permission==="full"?"完全访问":"默认权限"}</span><ChevronDown size={12}/>
              <select aria-label="执行权限" value={permission} disabled={send.isPending} onChange={e=>setPermission(e.target.value)}>
                <option value="default">默认权限</option><option value="full">完全访问</option>
              </select></label>
          </div>
        </div>
        {fileError && <p role="alert">{fileError}</p>}
        <Failure error={send.error || projects.error} />
        <small>Work 与你一起，把想法变成成果</small>
      </div>
    </aside>
  );
}
export function WorkspaceSearch() {
  const { workspace } = useTeam(),
    navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    const show = () => setOpen(true);
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("mw:search", show);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mw:search", show);
      window.removeEventListener("keydown", key);
    };
  }, []);
  const results = useTeamQuery(
    ["search", query],
    () =>
      request(
        workspace.id,
        "/search?q=" + encodeURIComponent(query.trim()),
        z.array(
          z.object({
            id: z.string(),
            kind: z.string(),
            source_id: z.string(),
            title: z.string(),
          }),
        ),
      ),
    open && !!query.trim(),
  );
  const items = (results.data || []).map((r) => {
    const path =
      r.kind === "issue"
        ? "/issue/" + r.id
        : r.kind === "project"
          ? "?view=projects&project=" + r.id
          : r.kind === "work"
            ? "?view=workbench&conversation=" + r.source_id
            : "?view=rooms&room=" +
              r.source_id +
              (r.kind === "room-message" ? "&message=" + r.id : "");
    return { key: r.kind + r.id, label: r.title, path };
  });
  return open ? (
    <Modal title="搜索" onClose={() => setOpen(false)}>
      <Input
        autoFocus
        aria-label="搜索工作区"
        placeholder="搜索任务、会话"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <Failure error={results.error} />
      {query.trim() &&
        !results.error &&
        items.map((i) => (
          <button
            key={i.key}
            className="team-setting-row"
            onClick={() => {
              navigate("/team/" + workspace.slug + i.path);
              setOpen(false);
            }}
          >
            {i.label}
          </button>
        ))}
      {!!query.trim() && !results.isPending && !items.length && (
        <Empty>没有搜索结果</Empty>
      )}
    </Modal>
  ) : null;
}

const Suggestion = z.object({
  id: z.string(),
  title: z.string(),
  project: z.string(),
  reason: z.string(),
});
export function WorkSuggestion() {
  const { workspace } = useTeam(),
    navigate = useNavigate();
  const [offer, setOffer] = useState<z.infer<typeof Suggestion> | null>(null),
    [why, setWhy] = useState(false),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let alive = true,
      pending = false,
      lastKey = 0;
    const key = () => {
      lastKey = Date.now();
    };
    const check = async () => {
      if (
        pending ||
        document.hidden ||
        Date.now() - lastKey < 8000 ||
        document.querySelector("[role=dialog],.v3-side-chat,.v3-suggestion")
      )
        return;
      pending = true;
      try {
        const data = await request(
          workspace.id,
          "/suggestions",
          z.union([Suggestion, z.object({})]),
          { action: "check" },
        );
        const parsed = Suggestion.safeParse(data);
        if (alive && parsed.success) {
          setOffer(parsed.data);
          setExpanded(true);
          setWhy(false);
        }
      } catch {
        /* Retry on the next foreground check. */
      } finally {
        pending = false;
      }
    };
    window.addEventListener("keydown", key);
    const interval = setInterval(check, 12000),
      initial = setTimeout(check, 18000);
    return () => {
      alive = false;
      window.removeEventListener("keydown", key);
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [workspace.id]);
  const act = useTeamAction(async (action: string) => {
    if (!offer) return;
    if (action === "snooze") {
      await request(workspace.id, "/suggestions", z.object({}), {
        action,
        id: offer.id,
      });
      setOffer(null);
      setExpanded(false);
      return;
    }
    const data = await request(
      workspace.id,
      "/suggestions",
      z.object({
        conversationId: z.string(),
        requestId: z.string(),
        prompt: z.string(),
      }),
      { action, id: offer.id },
    );
    await request(
      workspace.id,
      "/messages",
      z.object({ id: z.string() }),
      data,
    );
    navigate(
      `/team/${workspace.slug}?view=workbench&conversation=${data.conversationId}`,
    );
    setOffer(null);
    setExpanded(false);
  });
  return (
    <>
      <button
        className="v3-work-reminder"
        aria-expanded={expanded}
        aria-label={expanded ? "收起 Work 主动提醒" : "展开 Work 主动提醒"}
        onClick={() => setExpanded(!expanded)}
      >
        <Sparkles size={17} />
        {offer && <span>有件事想提醒您</span>}
      </button>
      {expanded && (
        <aside className="v3-suggestion" aria-label="Work 主动建议">
          {offer ? (
            <>
              <strong>Work 主动建议</strong>
              <p>
                {offer.project} · {offer.title}
              </p>
              <Action onClick={() => setWhy(!why)}>为什么想到这件事</Action>
              {why && <p>{offer.reason}</p>}
              <Failure error={act.error} />
              <div>
                <Action
                  disabled={act.isPending}
                  onClick={() => act.mutate("open")}
                >
                  一起看一下
                </Action>
                <Action
                  disabled={act.isPending}
                  onClick={() => act.mutate("snooze")}
                >
                  一小时后再说
                </Action>
                <Action onClick={() => setExpanded(false)}>收起</Action>
              </div>
            </>
          ) : (
            <>
              <strong>先安心做手头的事</strong>
              <p>暂时没有需要提醒的事项。</p>
            </>
          )}
        </aside>
      )}
    </>
  );
}
