import { Link, Paperclip } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import type { Issue, Comment } from "@multica/core/types";
import { useTeam, useTeamQuery, useTeamAction, teamApi } from "./client";
import { Action, Failure, Field, Input, Modal, Textarea } from "./ui";
import { teamFetch } from "./request-transport";
import { request, IDSchema } from "../workbench/api";

const RunReceipt = z.object({ id:z.string(), status:z.enum(["queued","failed"]), task_id:z.string().optional(), reason:z.string().optional() });
export function requestIssueRun(workspace:string, issue:string, key:string, source?:string) {
  return request(workspace,"/issues/"+issue+"/followup",RunReceipt,{ action:"run", id:key, source_task_id:source });
}

export async function saveTaskComment(workspace:string, path:string, method:"POST"|"PUT", body:Record<string,unknown>) {
  const response=await teamFetch(location.origin+"/api/"+path,{
    method,headers:{"X-Workspace-ID":workspace,"Content-Type":"application/json"},body:JSON.stringify({...body,suppress_run:true})
  });
  if (!response.ok) {
    const detail=await response.json().catch(()=>null);
    throw Error(typeof detail?.error==="string"?detail.error:"评论保存失败（"+response.status+"）");
  }
  return IDSchema.parse(await response.json());
}

export function CommentActions({ comment: c }: { comment: Comment }) {
  const { user, workspace } = useTeam(),
    [panel, setPanel] = useState(""),
    [body, setBody] = useState(c.content);
  const likes = c.reactions.filter((r) => r.emoji === "👍"),
    liked = likes.some((r) => r.actor_id === user.id);
  const act = useTeamAction(async (action: string) => {
    if (action === "edit")
      await saveTaskComment(workspace.id,"comments/"+c.id,"PUT",{content:body.trim(),content_base:c.content,expected_revision:c.revision});
    if (action === "delete")
      await teamApi.deleteComment(c.id, { keepReplies: true });
    if (action === "like") {
      if (liked) await teamApi.removeReaction(c.id, "👍");
      else await teamApi.addReaction(c.id, "👍");
    }
    setPanel("");
  });
  return (
    <>
      <Action onClick={() => navigator.clipboard.writeText(c.content)}>
        复制
      </Action>
      <Action
        aria-pressed={liked}
        disabled={act.isPending}
        onClick={() => act.mutate("like")}
      >
        👍 {likes.length}
      </Action>
      {c.author_id === user.id && (
        <>
          <Action
            onClick={() => {
              setBody(c.content);
              setPanel("edit");
            }}
          >
            编辑
          </Action>
          <Action onClick={() => setPanel("delete")}>删除</Action>
        </>
      )}
      {panel && (
        <Modal
          title={panel === "edit" ? "编辑评论" : "删除评论"}
          onClose={() => setPanel("")}
        >
          {panel === "edit" ? (
            <Textarea
              aria-label="评论内容"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          ) : (
            <p>删除这条评论后，已有回复将保留。</p>
          )}
          <Action onClick={() => setPanel("")}>取消</Action>
          <Action
            disabled={act.isPending || (panel === "edit" && !body.trim())}
            onClick={() => act.mutate(panel)}
          >
            确认
          </Action>
        </Modal>
      )}
      <Failure error={act.error} />
    </>
  );
}

const invalidLink = "请输入有效的 HTTP 或 HTTPS 链接";

const Follow = z.object({
  links: z.array(z.object({ id: z.string(), url: z.string(), title:z.string().optional() })),
  requests: z.array(RunReceipt.extend({created_at:z.string()})).default([]),
  reminders: z.array(
    z.object({
      id: z.string(),
      scheduled_at: z.string(),
      instruction: z.string(),
      status: z.string(),
    }),
  ),
});
function useIssueFollowup(issueId: string) {
  const {workspace, user} = useTeam();
  return useTeamQuery(["issue-followup", issueId, user.id], () =>
    request(workspace.id, "/issues/"+issueId+"/followup", Follow)
  );
}

export function IssueRunHistory({issueId, canRun, onRetry}: {issueId:string; canRun:boolean; onRetry:()=>void}) {
  const history = useIssueFollowup(issueId);
  if (!history.data?.requests.length) return <Failure error={history.error}/>;
  return <section className="v3-run-receipts" aria-label="我的执行请求">
    <h3>我的执行请求</h3>
    {history.data.requests.map(r => <article key={r.id}>
      <strong>{r.status === "queued" ? "已加入执行队列" : "入队失败"}</strong>
      <time dateTime={r.created_at}>{new Date(r.created_at).toLocaleString()}</time>
      <small>请求编号 {r.id}</small>
      {r.task_id && <small>队列编号 {r.task_id}</small>}
      {r.reason && <p>{r.reason}</p>}
      {r.status === "failed" && canRun && <Action size="sm" onClick={onRetry}>重试执行</Action>}
    </article>)}
    <Failure error={history.error}/>
  </section>;
}

export function IssueFollowup({ issue, part, onAttach, activePanel, onPanelChange }: { issue: Issue; part: "links"|"actions"; onAttach?: () => void; activePanel?:string; onPanelChange?:(panel:string)=>void }) {
  const { workspace } = useTeam(), path = "/issues/" + issue.id + "/followup";
  const q = useIssueFollowup(issue.id);
  const wakes = useTeamQuery(["issue-wakeups", issue.id], () =>
    teamApi.listIssueWakeups(issue.id),
  );
  const squads = useTeamQuery(
    ["squads"],
    () => teamApi.listSquads(),
    issue.assignee_type === "squad",
  );
  const agent =
    issue.assignee_type === "agent"
      ? issue.assignee_id
      : issue.assignee_type === "squad"
        ? squads.data?.find((s) => s.id === issue.assignee_id)?.leader_id
        : null;
  const [localPanel, setLocalPanel] = useState("");
  const panel = activePanel ?? localPanel;
  const setPanel = onPanelChange ?? setLocalPanel;
  const [url, setUrl] = useState(""),
    [linkTitle,setLinkTitle] = useState(""),
    [at, setAt] = useState(""),
    [note, setNote] = useState(""),
    [target, setTarget] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const act = useTeamAction(
    async ({ action, id }: { action: string; id?: string }) => {
      if (action === "wake") {
        if (!agent) throw Error("请选择智能体负责人");
        const when = new Date(at);
        if (!(when.getTime() > Date.now())) throw Error("请选择将来的时间");
        await teamApi.createIssueWakeup(issue.id, {
          agent_id: agent,
          instruction: note.trim(),
          kind: "at",
          at: when.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      } else if (action === "run") {
        if (!agent) throw Error("任务没有智能体负责人");
        const result=await requestIssueRun(workspace.id,issue.id,key);
        if(result.status==="failed"){setKey(crypto.randomUUID());await q.refetch();throw Error(result.reason || "执行请求失败");}
      } else if (action === "disableWake")
        await teamApi.disableIssueWakeup(issue.id, id!);
      else if (action === "enableWake")
        await teamApi.enableIssueWakeup(issue.id, id!, {
          revision: wakes.data?.find((w) => w.id === id)?.revision || 0,
        });
      else if (action === "deleteWake")
        await teamApi.deleteIssueWakeup(issue.id, id!);
      else {
        const data: Record<string, unknown> = { action, id: id || key };
        if (action === "schedule") {
          const when = new Date(at);
          if (!(when.getTime() > Date.now())) throw Error("请选择将来的时间");
          data.at = when.toISOString();
          data.instruction = note;
        }
        if (action === "link") {
          let target: URL;
          try {
            target = new URL(url.trim());
          } catch {
            throw Error(invalidLink);
          }
          if (!["http:","https:"].includes(target.protocol) || target.username || target.password)
            throw Error(invalidLink);
          data.url = target.href;
          data.title = linkTitle.trim();
        }
        await request(workspace.id, path, IDSchema, data);
      }
      setPanel("");
      setKey(crypto.randomUUID());
      setNote("");
      setAt("");
      setUrl("");
    },
  );
  return (
    <section className="team-settings-section">
      {part==="links" && <div className="v3-issue-links">
      <div className="v3-description-tools">
        <button type="button" title="添加任务附件" aria-label="添加任务附件" onClick={onAttach}><Paperclip size={14}/></button>
        <button type="button" title="添加关联链接" aria-label="添加关联链接" onClick={() => {act.reset();setUrl("");setLinkTitle("");setPanel("link");}}><Link size={14}/></button>
      </div>
      {q.data?.links.map((l) => (
        <div key={l.id}>
          <a href={l.url} title={l.url} target="_blank" rel="noreferrer">
            {l.title || new URL(l.url).hostname}
          </a>
          <Action aria-label={"移除链接 " + (l.title || new URL(l.url).hostname)}
            onClick={() => {
              act.reset();
              setTarget(l.id);
              setPanel("unlink");
            }}
          >
            移除
          </Action>
        </div>
      ))}
      </div>}
      {part==="actions" && <>
      {q.data?.reminders.map((r) => (
        <div key={r.id}>
          {new Date(r.scheduled_at).toLocaleString()} · {r.instruction} ·{" "}
          {
            { scheduled: "已安排", paused: "已暂停", delivered: "已送达" }[
              r.status
            ]
          }
          {r.status !== "delivered" && (
            <Action
              disabled={act.isPending}
              onClick={() =>
                act.mutate({
                  action: r.status === "scheduled" ? "pause" : "resume",
                  id: r.id,
                })
              }
            >
              {r.status === "scheduled" ? "暂停" : "恢复"}
            </Action>
          )}
          <Action
            onClick={() => {
              setTarget(r.id);
              setPanel("delete");
            }}
          >
            删除
          </Action>
        </div>
      ))}
      {wakes.data?.map((w) => (
        <div key={w.id}>
          {w.agent_name} · {w.instruction} ·{" "}
          {w.next_fire_at && new Date(w.next_fire_at).toLocaleString()} ·{" "}
          {w.last_error || (w.enabled ? "已安排" : "已暂停")}
          <Action
            disabled={act.isPending}
            onClick={() =>
              act.mutate({
                action: w.enabled ? "disableWake" : "enableWake",
                id: w.id,
              })
            }
          >
            {w.enabled ? "暂停" : "恢复"}
          </Action>
          <Action
            onClick={() => {
              setTarget(w.id);
              setPanel("deleteWake");
            }}
          >
            删除
          </Action>
        </div>
      ))}
      <Action onClick={() => setPanel("schedule")}>提醒我</Action>
      <Action disabled={!agent} onClick={() => setPanel("wake")}>
        安排智能体唤醒
      </Action>
      </>}
      <Failure error={q.error || wakes.error || act.error} />
      {panel && (
        <Modal
          title={
            panel === "link"
              ? "关联链接"
              : panel === "schedule"
                ? "安排提醒"
                : panel === "wake"
                  ? "安排智能体唤醒"
                  : panel === "run"
                    ? "请求智能体执行"
                    : "确认移除"
          }
          onClose={() => setPanel("")}
        >
          {panel === "link" && (
            <><Field label="名称"><Input aria-label="链接名称" value={linkTitle} onChange={e=>setLinkTitle(e.target.value)} placeholder="Pull Request 或相关资源"/></Field>
            <Field label="URL">
              <Input aria-label="链接地址" type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            </Field></>
          )}
          {panel === "unlink" && <p>移除「{q.data?.links.find(l=>l.id===target)?.title || q.data?.links.find(l=>l.id===target)?.url}」的引用？</p>}
          {["schedule", "wake"].includes(panel) && (
            <>
              <Field label="时间">
                <input
                  type="datetime-local"
                  value={at}
                  onChange={(e) => setAt(e.target.value)}
                />
              </Field>
              <Field label="内容">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
            </>
          )}
          <Failure error={act.error} message={panel === "run" || act.error?.message === invalidLink || act.error?.message === "请选择将来的时间" ? act.error?.message : undefined}/>
          <Action onClick={() => setPanel("")}>取消</Action>
          <Action
            disabled={
              act.isPending ||
              (panel === "link" && !url.trim()) ||
              (["schedule", "wake"].includes(panel) && (!at || !note.trim()))
            }
            onClick={() =>
              act.mutate({
                action: panel,
                id: ["delete", "deleteWake", "unlink"].includes(panel)
                  ? target
                  : undefined,
              })
            }
          >
            {panel === "link" ? "保存" : panel === "unlink" ? "移除链接" : "确认"}
          </Action>
        </Modal>
      )}
    </section>
  );
}
