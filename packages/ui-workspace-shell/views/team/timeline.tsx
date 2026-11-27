import { MemberExecutions } from "./member-executions";
import { isRecoveryNotice, waitingAtEvaluation } from "./timeline-presentation";
import { ensureAgentAuth, runFailureHint, failureForEntry } from "./model-auth";
import { CollapsibleMessage } from "./collapsible-message";
import { useEffect, useRef, useState } from "react";
import { AtSign, Send, CornerDownRight, X } from "lucide-react";
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
  heading,
}: {
  heading?: string;
  issue: Issue;
  entries: TimelineEntry[];
  runs: AgentTask[];
  people: ReturnType<typeof useTeamPeople>;
}) {
  const { workspace, user } = useTeam();
  const [draft, setDraft] = useState("");
  const [debounced, setDebounced] = useState("");
  const [reply, setReply] = useState<TimelineEntry | null>(null);
  const [menu, setMenu] = useState(false);
  const [activeMention, setActiveMention] = useState(0);
  const mentionList = useRef<HTMLDivElement>(null);
  const [suppressed, setSuppressed] = useState<string[]>([]);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const editor = useRef<MentionEditorHandle>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(draft), 300);
    return () => clearTimeout(timer);
  }, [draft]);
  const preview = useTeamQuery(
    ["trigger", issue.id, debounced, reply?.id],
    () => teamApi.previewCommentTriggers(issue.id, debounced, reply?.id),
    !!debounced.trim() || files.length > 0,
  );
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
      suppressed,
    ]);
    if (requestPayload.current && requestPayload.current !== payload)
      requestID.current = crypto.randomUUID();
    requestPayload.current = payload;
    try {
      const triggers = await teamApi.previewCommentTriggers(
        issue.id,
        draft,
        reply?.id,
      );
      for (const agent of triggers.agents.filter(
        (a) => !suppressed.includes(a.id),
      ))
        await ensureAgentAuth(agent.id, user.id, workspace.id);
      const posted = await teamApi.createComment(
        issue.id,
        draft,
        "comment",
        reply?.id,
        files.map((f) => f.id),
        suppressed,
        undefined,
        requestID.current,
      );
      requestID.current = crypto.randomUUID();
      requestPayload.current = "";
      editor.current?.clear();
      setDraft("");
      setDebounced("");
      setReply(null);
      setFiles([]);
      setSuppressed([]);
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
  const replying = reply ? entries.find((e) => e.id === reply.id) : null;
  return (
    <section
      className="team-timeline"
      onKeyDownCapture={(e) => {
        if (!menu || e.nativeEvent.isComposing || e.keyCode === 229) return;
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
      <h3>{heading || text("collaboration")}</h3>
      {entries.length === 0 && <Empty>{text("noComments")}</Empty>}
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
      <div className="team-composer">
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
            editorRef={editor}
            disabled={send.isPending}
            onChange={(value) => {
              setDraft(value);
              if (value.endsWith("@")) setMenu(true);
            }}
          />
        </div>
        <div className="team-trigger-preview">
          {draft !== debounced || preview.isFetching ? (
            <span>{text("checkingTrigger")}</span>
          ) : preview.data?.agents.length ? (
            <>
              <span>{text("willTrigger")}</span>
              {preview.data.agents.map((agent) => (
                <label key={agent.id}>
                  <input
                    type="checkbox"
                    checked={!suppressed.includes(agent.id)}
                    onChange={(e) =>
                      setSuppressed((s) =>
                        e.target.checked
                          ? s.filter((id) => id !== agent.id)
                          : [...s, agent.id],
                      )
                    }
                  />
                  {agent.name}
                </label>
              ))}
            </>
          ) : (
            <span>{text("onlyComment")}</span>
          )}
          {preview.data?.blocked?.length ? (
            <span>
              {text(
                preview.data.blocked.some(
                  (o) => o.reason_code === "invocation_scope_conflict",
                )
                  ? "scopeConflict"
                  : "triggerBlocked",
              )}
            </span>
          ) : null}
        </div>
        <Failure error={send.error || preview.error || people.squads.error} />
        {send.data?.trigger_outcomes?.some((o) => o.status === "blocked") && (
          <div role="status" className="team-notice">
            {text(
              send.data.trigger_outcomes?.some(
                (o) => o.reason_code === "invocation_scope_conflict",
              )
                ? "scopeConflict"
                : "commentSavedBlocked",
            )}
          </div>
        )}
        <UploadFiles
          onPendingChange={setUploading}
          files={files}
          onChange={setFiles}
          disabled={send.isPending}
        >
          <div className="team-mention-container">
            <Action onClick={() => setMenu(!menu)}>
              <AtSign size={16} />
              {text("mention")}
            </Action>
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
          <Action
            primary
            disabled={
              send.isPending ||
              uploading ||
              (!draft.trim() && !files.length) ||
              draft !== debounced ||
              preview.isFetching ||
              !!preview.error
            }
            onClick={() => send.mutate()}
          >
            <Send size={15} />
            {text(send.isPending ? "sending" : "send")}
          </Action>
        </UploadFiles>
      </div>
    </section>
  );
}
