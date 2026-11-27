import {CommentActions,saveTaskComment} from "./issue-followup";
import { MemberExecutions } from "./member-executions";
import { isRecoveryNotice, waitingAtEvaluation } from "./timeline-presentation";
import { runFailureHint, failureForEntry } from "./model-auth";
import { CollapsibleMessage } from "./collapsible-message";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AtSign, ArrowUp, Send, CornerDownRight, X } from "../icons";
import type {
  Issue,
  TimelineEntry,
  Attachment,
  AgentTask,
} from "@multica/core/types";
import { teamApi, text, useTeam, useTeamQuery, useTeamAction } from "./client";
import { MentionEditor, type MentionEditorHandle } from "./mention-editor";
import { excerpt, locate } from "./relations";
import { EventSummary } from "./event-summary";
import { Action, Avatar, Empty, Failure } from "./ui";
import { UploadFiles, FileButton } from "./task-files";
import type { useTeamPeople } from "./tasks";
export function TimelineComposer({
  issue,
  entries,
  people,
  runs,
  heading, children, subscription, fileInput,
}: {
  heading?: string;
  children?: ReactNode;
  subscription?: ReactNode;
  fileInput?: RefObject<HTMLInputElement | null>;
  issue: Issue;
  entries: TimelineEntry[];
  runs: AgentTask[];
  people: ReturnType<typeof useTeamPeople>;
}) {
  const { workspace } = useTeam();
 const commentRows=useTeamQuery(["issue-comments",issue.id],()=>teamApi.listComments(issue.id));
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<TimelineEntry | null>(null);
  const [menu, setMenu] = useState(false);
  const [activeMention, setActiveMention] = useState(0);
  const mentionList = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const editor = useRef<MentionEditorHandle>(null);
  const sending = useRef(false);
  const requestID = useRef(crypto.randomUUID());
  const requestPayload = useRef("");
  const send = useTeamAction(async () => {
    if (sending.current) return;
    sending.current = true;
    const payload = JSON.stringify([
      draft,
      reply?.id,
      files.map((f) => f.id),
    ]);
    if (requestPayload.current && requestPayload.current !== payload)
      requestID.current = crypto.randomUUID();
    requestPayload.current = payload;
    try {
      const posted = await saveTaskComment(workspace.id,"issues/"+issue.id+"/comments","POST",{
        content:draft,type:"comment",parent_id:reply?.id,attachment_ids:files.map(file=>file.id),request_id:requestID.current
      });
      requestID.current = crypto.randomUUID();
      requestPayload.current = "";
      editor.current?.clear();
      setDraft("");
      setReply(null);
      setFiles([]);
      return posted;
    } finally {
      sending.current = false;
    }
  });
  const mention = (id: string, name: string, type = "agent") => {
    editor.current?.mention(id, name, type);
    setMenu(false);
    editor.current?.focus();
  };
  const candidates = [
    ...(people.agents.data || []).map((a) => ({
      id: a.id,
      name: a.name,
      type: "agent",
      disabled: !people.allowed(a),
      detail: text("mentionAgent"),
    })),
    ...(people.members.data || []).map((m) => ({
      id: m.user_id,
      name: m.name || m.email,
      type: "member",
      disabled: false,
      detail: text("mentionMember"),
    })),
    ...(people.squads.data || [])
      .filter((s) => !s.archived_at)
      .map((s) => ({
        id: s.id,
        name: s.name,
        type: "squad",
        disabled: !people.allowedSquad(s),
        detail: text("mentionSquad"),
      })),
  ].filter((candidate) => !candidate.disabled);
  useEffect(() => {
    if (!menu) return;
    setActiveMention(
      Math.max(
        0,
        candidates.findIndex((candidate) => !candidate.disabled),
      ),
    );
  }, [menu]);
  useEffect(() => {
    mentionList.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeMention]);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        !event.target.closest(".team-mention-container, .team-editor-wrap")
      )
        setMenu(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [menu]);
  const entryName = (entry: TimelineEntry) => entry.actor_type === "system" ? text("systemNotice") : entry.actor_name || people.name(entry.actor_id);
  const previewEntry = (entry: TimelineEntry) => {
    if (isRecoveryNotice(entry)) return text("delegatedFailureNotice");
    const failure = failureForEntry(entry, runs);
    return failure
      ? text(runFailureHint(failure.error, failure.failure_reason))
      : excerpt(entry);
  };
  const detail = Boolean(children);
  const canSend = !send.isPending && !uploading && Boolean(draft.trim() || files.length);
  const replying = reply ? entries.find((e) => e.id === reply.id) : null;
  return (
    <section
      className="team-timeline"
      onKeyDownCapture={(e) => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (detail && !menu && e.key === "Enter" && (e.metaKey || e.ctrlKey) &&
            e.target instanceof Element && e.target.closest(".team-editor-wrap")) {
          e.preventDefault();
          if (canSend) send.mutate();
          return;
        }
        if (!menu) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setMenu(false);
          editor.current?.focus();
          return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const direction = e.key === "ArrowDown" ? 1 : -1;
          for (let step = 1; step <= candidates.length; step++) {
            const index =
              (activeMention + direction * step + candidates.length) %
              candidates.length;
            if (!candidates[index].disabled) {
              setActiveMention(index);
              break;
            }
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          const selected = candidates[activeMention];
          if (selected && !selected.disabled)
            mention(selected.id, selected.name, selected.type);
        }
      }}
    >
      <div className={detail ? "v3-issue-scroll" : undefined}>
      {children}
      {detail ? <header className="v3-activity-heading"><h2>{heading} <small>{entries.length}</small></h2>{subscription}</header>
        : <h3>{heading || text("collaboration")}</h3>}
      {!detail && entries.length === 0 && <Empty>{text("noComments")}</Empty>}
      {entries.map((entry) => {
        const failedRun = failureForEntry(entry, runs);
        const parent = entries.find((e) => e.id === entry.parent_id);
        return (
          <article
            className={`team-entry-row ${entry.type === "activity" ? "team-activity" : ""}`}
            id={`comment-${entry.id}`}
            key={entry.id}
          >
            <Avatar name={entryName(entry)} />
            <div>
              <div className="team-entry-meta">
                <strong>
                  {entryName(entry)}
                </strong>
                <time>{new Date(entry.created_at).toLocaleString()}</time>
              </div>
              {entry.parent_id && (
                <button
                  className="team-reply-context"
                  disabled={!parent}
                  onClick={() => locate(`comment-${entry.parent_id}`)}
                >
                  <CornerDownRight size={13} />
                  <span>
                    <strong>
                      {text("replyTo")}{" "}
                      {parent ? entryName(parent) : text("messageUnavailable")}
                    </strong>
                    <span>
                      {parent
                        ? parent.deleted_at
                          ? text("deletedComment")
                          : previewEntry(parent)
                        : text("messageUnavailable")}
                    </span>
                  </span>
                </button>
              )}
              {entry.type === "comment" ? (
                <>
                  {isRecoveryNotice(entry) && !entry.deleted_at ? (
                    <div><p>{text("delegatedFailureNotice")}</p><details><summary>{text("diagnostics")}</summary><pre>{entry.content}</pre></details></div>
                  ) : failedRun ? (
                    <div>
                      <p>
                        {text(
                          runFailureHint(
                            failedRun.error,
                            failedRun.failure_reason,
                          ),
                        )}
                      </p>
                      <details>
                        <summary>{text("diagnostics")}</summary>
                        <pre>{entry.content}</pre>
                      </details>
                    </div>
                  ) : (
                    <CollapsibleMessage
                      content={
                        entry.deleted_at
                          ? text("deletedComment")
                          : entry.content || ""
                      }
                    />
                  )}
                  <div className="team-comment-files">
                    {entry.attachments?.map((f) => (
                      <FileButton key={f.id} file={f} />
                    ))}
                  </div>
                </>
              ) : (
                <EventSummary
                  action={entry.action || "updated"}
                  details={entry.details}
                  name={people.name}
                  waiting={waitingAtEvaluation(entry, runs)}
                />
              )}
              <div className="team-related-runs">
                {entry.type==="comment"&&!entry.deleted_at&&commentRows.data?.filter(c=>c.id===entry.id).map(c=><CommentActions key={c.id} comment={c}/>)}
                {entry.type === "comment" && !entry.deleted_at && (
                  <button
                    className="team-text-action"
                    onClick={() => {
                      setReply(entry);
                      editor.current?.focus();
                    }}
                  >
                    {text("reply")}
                  </button>
                )}

              </div>
              <MemberExecutions entry={entry} runs={runs} name={people.name} />
            </div>
          </article>
        );
      })}
      </div>
      <div className={detail ? "v3-fixed-comment" : undefined}><div className="team-composer">
        {replying && (
          <div className="team-reply-target">
            <button
              className="team-reply-context"
              onClick={() => locate(`comment-${replying.id}`)}
            >
              <span>
                <strong>
                  {text("replyTo")}{" "}
                  {entryName(replying)}
                </strong>
                <span>
                  {replying.deleted_at
                    ? text("deletedComment")
                    : previewEntry(replying)}
                </span>
              </span>
            </button>
            <Action
              aria-label={text("cancelReply")}
              size="icon-sm"
              onClick={() => setReply(null)}
            >
              <X size={14} />
            </Action>
          </div>
        )}
        <div className="team-editor-wrap">
          <MentionEditor
            placeholder={detail ? "留下评论…" : undefined}
            editorRef={editor}
            disabled={send.isPending}
            onChange={(value) => {
              setDraft(value);
              if (value.endsWith("@")) setMenu(true);
            }}
          />
        </div>
        <Failure error={send.error || people.squads.error} />
        <UploadFiles
          inputRef={fileInput}
          buttonLabel={detail ? "评论添加附件" : undefined}
          onPendingChange={setUploading}
          files={files}
          onChange={setFiles}
          disabled={send.isPending}
        >
          <div className="team-mention-container">
            {!detail && <Action onClick={() => setMenu(!menu)}>
              <AtSign size={16} />
              {text("mention")}
            </Action>}
            {menu && (
              <div
                className="team-mention-menu"
                role="listbox"
                aria-label={text("mention")}
                ref={mentionList}
              >
                {candidates.map((candidate, index) => (
                  <button
                    role="option"
                    aria-selected={activeMention === index}
                    key={`${candidate.type}:${candidate.id}`}
                    disabled={candidate.disabled}
                    onMouseEnter={() => setActiveMention(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      mention(candidate.id, candidate.name, candidate.type)
                    }
                  >
                    <Avatar name={candidate.name} />
                    <span>
                      {candidate.name}
                      <small>{candidate.detail}</small>
                      {candidate.disabled && (
                        <small>{text("noPermission")}</small>
                      )}
                    </span>
                  </button>
                ))}
                {!people.agents.data?.length && (
                  <small>{text("noAgents")}</small>
                )}
              </div>
            )}
          </div>
          {detail && <small className="v3-comment-shortcut">⌘ Enter 发送</small>}
          <Action
            primary
            aria-label={detail ? "发送评论" : undefined}
            disabled={!canSend}
            onClick={() => send.mutate()}
          >
            {detail ? <ArrowUp size={16}/> : <><Send size={15}/>{text(send.isPending ? "sending" : "send")}</>}
          </Action>
        </UploadFiles>
      </div></div>
    </section>
  );
}
