import {useMessageAnchor} from "./locate-message";
import {ArrowLeft, Bot, LockKeyhole, Send} from "lucide-react";
import type {Attachment} from "@multica/core/types";
import {UploadFiles} from "./task-files";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  teamApi,
  teamServer,
  useTeam,
  useTeamQuery,
  useTeamAction,
} from "./client";
import { teamFetch } from "./request-transport";
import { Action, Failure, Textarea } from "./ui";

export function ChatEntry({ agent, title }: { agent: string; title: string }) {
  const { workspace } = useTeam(),
    [, setParams] = useSearchParams();
  const start = useTeamAction(async () => {
    const session = await teamApi.createChatSession(
      { agent_id: agent, title },
      workspace.slug,
    );
    setParams({ view: "agent-chat", chat: session.id });
  });
  return (
    <>
      <Action
        disabled={!agent || start.isPending}
        onClick={() => start.mutate()}
      >
        发起对话
      </Action>
      <Failure error={start.error} />
    </>
  );
}
export function AgentChat() {
  const { workspace, user } = useTeam(),
    [params, setParams] = useSearchParams(),
    id = params.get("chat") || "";
  const [draft, setDraft] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const [files,setFiles]=useState<Attachment[]>([]),[uploading,setUploading]=useState(false),[failedUpload,setFailedUpload]=useState(false);
  const session = useTeamQuery(
    ["chat-session", user.id, id],
    () => teamApi.getChatSession(id),
    !!id,
  );
  const agentId = session.data?.agent_id;
  const agent = useTeamQuery(
    ["chat-agent", agentId],
    () => teamApi.getAgent(agentId!),
    !!agentId,
  );
  const messages = useQuery({
    queryKey: ["team", workspace.id, "agent-messages", user.id, id],
    queryFn: () => teamApi.listChatMessages(id),
    enabled: !!session.data,
    refetchInterval: 2500,
    retry: false,
  });
  const targetMessage = params.get("message");
  useMessageAnchor("agent-chat-message-", targetMessage, !!messages.data?.some(m=>m.id===targetMessage));
  const client=useQueryClient();
  const lastReply=messages.data?.filter(m=>m.role==="assistant").at(-1)?.id;
  useEffect(()=>{
    if(!lastReply) return;
    void teamFetch(teamServer+"/api/chat/sessions/"+id+"/read",{method:"POST",headers:{"X-Workspace-ID":workspace.id}})
      .then(response=>{if(response.ok)return client.invalidateQueries({queryKey:["team",workspace.id,"navigation",user.id]})})
      .catch(()=>{});
  },[workspace.id,user.id,id,lastReply,client]);
  const send = useTeamAction(async () => {
    const r = await teamFetch(
      teamServer + "/api/chat/sessions/" + id + "/messages",
      {
        method: "POST",
        headers: {
          "X-Workspace-ID": workspace.id,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: draft.trim() || files.map(f=>f.filename).join("、"), request_id: key, attachment_ids:files.map(f=>f.id) }),
      },
    );
    if (!r.ok) {
      const e = await r.json();
      throw Error(e.error || "发送失败");
    }
    const sent=await r.json();
    const missing=files.filter(f=>!sent.attachment_ids?.includes(f.id));
    setFiles(missing);
    setDraft("");
    setKey(crypto.randomUUID());
    await messages.refetch();
    if(missing.length)throw Error("消息已提交，部分附件未关联，请重试附件。");
  });
  return (
    <section className="v3-agent-chat">
      <header><Action aria-label="返回智能体" onClick={()=>setParams({view:"agents"})}><ArrowLeft size={16}/></Action>
        <span className="agent-chat-avatar"><Bot size={21}/></span><h1>{session.data?.title || "智能体对话"}</h1></header>
      <div className="agent-chat-scroll">
      <Failure error={session.error || messages.error} />
      {messages.data?.length === 0 && <div className="agent-chat-empty"><span className="agent-chat-avatar"><Bot size={24}/></span><h2>与{agent.data?.name||"智能体"}对话</h2><p>沿用智能体的模型和运行环境。</p></div>}
      {messages.data?.map((m) => (
        <article id={"agent-chat-message-"+m.id} className={"v3-chat-message "+(m.role==="user"?"agent-chat-mine":"")} key={m.id}>
          <strong>{m.role === "user" ? user.name : session.data?.title}</strong>
          <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</time><p>{m.content}</p>
          {m.attachments?.map(f=><Action key={f.id} onClick={()=>setParams({view:"files",file:f.id})}>{f.filename}</Action>)}
          {m.failure_reason && <p role="alert">{m.failure_reason}</p>}
        </article>
      ))}
      </div>
      <div className="agent-chat-input">
      <div className="agent-chat-recipient"><Bot size={16}/><strong>{agent.data?.name}</strong><small><LockKeyhole size={11}/>沿用智能体配置</small></div>
      {!messages.isPending &&
        messages.data?.length === 0 &&
        agent.data?.conversation_starters?.map((s, i) => (
          <Action
            key={i}
            onClick={() => {
              setDraft(s.prompt);
              setKey(crypto.randomUUID());
            }}
          >
            {s.label}
          </Action>
        ))}
      <Textarea
        aria-label="会话消息"
        disabled={send.isPending}
        value={draft}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if((draft.trim()||files.length)&&!uploading&&!failedUpload&&!send.isPending&&!session.error)send.mutate()}}}
        onChange={(e) => {
          setDraft(e.target.value);
          setKey(crypto.randomUUID());
        }}
      />
      <UploadFiles chatSessionId={id} files={files} onChange={f=>{setFiles(f);setKey(crypto.randomUUID())}} disabled={send.isPending||!!session.error} onPendingChange={setUploading} onFailureChange={setFailedUpload}>
      <Action
        disabled={(!draft.trim() && !files.length) || uploading || failedUpload || send.isPending || !!session.error}
        onClick={() => send.mutate()}
      >
        <Send size={15}/>发送
      </Action>
      </UploadFiles>
      <Failure error={send.error} />
      </div>
    </section>
  );
}
