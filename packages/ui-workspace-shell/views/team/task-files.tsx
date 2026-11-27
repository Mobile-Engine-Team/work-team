import {
  ensureAgentAuth,
  AgentAuthPanel,
  runFailureHint,
  failureForEntry,
  needsModelAuth,
} from "./model-auth";
import { ExecutionStatus } from "./execution-status";
import { useRef, useState, useEffect, type ReactNode } from "react";
import {
  FileText,
  Download,
  Paperclip,
  X,
  Play,
  Square,
  RotateCcw,
} from "lucide-react";
import {
  collectDeliverableFiles,
  findDeliverableVersion,
} from "@multica/core/attachments/deliverables";
import type { Attachment, TimelineEntry, AgentTask } from "@multica/core/types";
import { teamApi, text, useTeam, useTeamAction, useTeamQuery } from "./client";
import { Action, Failure, Empty, Modal } from "./ui";
import { excerpt, isActiveRun, locate, runInputIds } from "./relations";
import { TeamMarkdown } from "./markdown";
import type { useTeamPeople } from "./tasks";
export function UploadFiles({
  files,
  onChange,
  onPendingChange,
  onFailureChange,
  disabled = false,
  children,
}: {
  files: Attachment[];
  onChange: (v: Attachment[]) => void;
  onPendingChange: (pending: boolean) => void;
  onFailureChange?: (failed: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const upload = useTeamAction(async (selected: File[]) => {
    if (busy.current) return;
    busy.current = true;
    onPendingChange(true);
    const result = [...files];
    const failures: File[] = [];
    try {
      for (const file of selected) {
        try {
          const attachment = await teamApi.uploadFile(file);
          if (!attachment.id) throw new Error(text("uploadFailed"));
          result.push(attachment);
          onChange([...result]);
        } catch {
          failures.push(file);
        }
      }
      setFailedFiles(previous => [...previous.filter(file => !selected.includes(file)), ...failures]);
      if (failures.length) throw new Error(text("uploadFailed"));
    } finally {
      busy.current = false;
      onPendingChange(false);
    }
  });
  useEffect(
    () => {
      const failed = failedFiles.length > 0;
      onPendingChange(upload.isPending || (!onFailureChange && failed));
      onFailureChange?.(failed);
    },
    [upload.isPending, failedFiles.length, onPendingChange, onFailureChange],
  );
  return (
    <div className="team-upload">
      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          upload.mutate(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {(files.length > 0 || failedFiles.length > 0 || upload.isPending) && (
        <div className="team-draft-files" aria-live="polite">
          {files.map((f) => (
            <span className="team-file-chip" key={f.id}>
              <span>
                {f.filename}
                <small>{text("draftAttachment")}</small>
              </span>
              <button
                disabled={disabled || upload.isPending}
                aria-label={text("removeFile")}
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {failedFiles.map((f, index) => (
            <span className="team-file-chip" key={index}>
              {f.name} · {text("uploadFailed")}
              <button
                disabled={disabled || upload.isPending}
                aria-label={text("removeFile")}
                onClick={() => {
                  setFailedFiles(failedFiles.filter((_, i) => i !== index));
                  if (failedFiles.length === 1) upload.reset();
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {upload.isPending && <span>{text("uploading")}</span>}
        </div>
      )}
      <Failure error={upload.error} />
      <div className="team-composer-footer">
        <Action
          disabled={disabled || upload.isPending}
          onClick={() => input.current?.click()}
        >
          <Paperclip size={15} />
          {text("attach")}
        </Action>
        {!!failedFiles.length && (
          <Action
            disabled={disabled || upload.isPending}
            onClick={() => upload.mutate(failedFiles)}
          >
            {text("retry")}
          </Action>
        )}
        {children}
      </div>
    </div>
  );
}
function Preview({ file, onClose }: { file: Attachment; onClose: () => void }) {
  const content = useTeamQuery(["preview", file.id], () =>
    teamApi.getAttachmentTextContent(file.id),
  );
  const download = useTeamAction(async () => {
    const blob = await teamApi.getAttachmentBlob(file.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  });
  return (
    <Modal title={file.filename} onClose={onClose} wide>
      <div className="team-toolbar">
        <small>{(file.size_bytes / 1024).toFixed(1)} KB</small>
        <Action disabled={download.isPending} onClick={() => download.mutate()}>
          <Download size={15} />
          {text("download")}
        </Action>
      </div>
      <Failure error={download.error} />
      {content.isPending ? (
        <Empty>{text("loading")}</Empty>
      ) : content.error ? (
        <>
          <p>{text("previewUnavailable")}</p>
          <Failure error={content.error} />
        </>
      ) : (
        <div className="team-file-preview">
          {file.filename.endsWith(".md") ? (
            <TeamMarkdown content={content.data?.text || ""} />
          ) : (
            <pre>{content.data?.text}</pre>
          )}
        </div>
      )}
    </Modal>
  );
}
export function FileButton({ file }: { file: Attachment }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="team-file-link" onClick={() => setOpen(true)}>
        <FileText size={16} />
        {file.filename}
      </button>
      {open && <Preview file={file} onClose={() => setOpen(false)} />}
    </>
  );
}
export function TaskArtifacts({
  entries,
  inputs,
  runs,
}: {
  entries: TimelineEntry[];
  inputs: Attachment[];
  runs: AgentTask[];
}) {
  const outputs = collectDeliverableFiles(entries);
  return (
    <>
      <section className="team-artifacts">
        <h3>
          <FileText size={17} />
          {text("artifacts")} <small>{outputs.length}</small>
        </h3>
        {!outputs.length && <Empty>{text("noArtifacts")}</Empty>}
        {outputs.map((output) => {
          const renderVersion = (file: Attachment, version: number) => {
            const comment = entries.find(
              (e) =>
                e.type === "comment" &&
                e.attachments?.some((a) => a.id === file.id),
            );
            const run = runs.find((r) => r.id === comment?.source_task_id);
            return (
              <article
                className="team-output"
                id={`artifact-${file.id}`}
                key={file.id}
              >
                <FileButton file={file} />
                <div className="team-output-meta">
                  <span>{(file.size_bytes / 1024).toFixed(1)} KB</span>
                  <span>v{version}</span>
                </div>
                {comment && (
                  <button
                    className="team-text-action"
                    onClick={() => locate(`comment-${comment.id}`)}
                  >
                    {text("locateComment")}
                  </button>
                )}
                {run && (
                  <button
                    className="team-text-action"
                    onClick={() => locate(`run-${run.id}`)}
                  >
                    {text("relatedRun")}
                  </button>
                )}
              </article>
            );
          };
          return (
            <div className="team-output-group" key={output.key}>
              {renderVersion(output.latest, output.versions.length)}
              {output.versions.length > 1 && (
                <details className="team-version-history">
                  <summary>
                    {text("versionHistory")} · {output.versions.length - 1}
                  </summary>
                  {output.versions
                    .slice(0, -1)
                    .map((file, index) => renderVersion(file, index + 1))}
                </details>
              )}
            </div>
          );
        })}
      </section>
      <section className="team-artifacts">
        <h3>{text("inputs")}</h3>
        {inputs.map((f) => (
          <div className="team-output" key={f.id}>
            <FileButton file={f} />
          </div>
        ))}
        {!inputs.length && <small>{text("noInputs")}</small>}
      </section>
    </>
  );
}
export function RunList({
  issueId,
  people,
  runs,
  entries,
  error,
}: {
  issueId: string;
  people: ReturnType<typeof useTeamPeople>;
  runs: AgentTask[];
  entries: TimelineEntry[];
  error: unknown;
}) {
  const { workspace, user } = useTeam();
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = runs.find((run) => run.id === selectedId);
  const action = useTeamAction(
    async ({ run, retry }: { run: AgentTask; retry: boolean }) => {
      if (retry) {
        await ensureAgentAuth(run.agent_id, user.id, workspace.id);
        return teamApi.rerunIssue(issueId, run.id);
      }
      return teamApi.cancelTask(issueId, run.id);
    },
  );
  const messages = useTeamQuery(
    ["runMessages", selectedId],
    () => teamApi.listTaskMessages(selectedId!),
    !!selectedId,
  );
  const ordered = [...runs].sort(
    (a, b) =>
      Date.parse(b.created_at) - Date.parse(a.created_at) ||
      b.id.localeCompare(a.id),
  );
  const active = ordered.filter(isActiveRun);
  const featured = active.length ? active : ordered.slice(0, 1);
  const history = ordered.filter((run) => !featured.includes(run));
  const outputs = collectDeliverableFiles(entries);
  const renderRun = (run: AgentTask) => {
    const inputs = runInputIds(run);
    const deliveries = entries.filter(
      (e) =>
        e.type === "comment" && e.source_task_id === run.id && !e.deleted_at,
    );
    return (
      <article className="team-run-card" id={`run-${run.id}`} key={run.id}>
        <div className="team-run-row">
          <Play size={14} />
          <strong>{people.name(run.agent_id)}</strong>
          <ExecutionStatus runs={[run]} />
          {run.project_plan?.project_id && run.project_plan.version !== undefined && <ProjectRunVersion run={run} />}
          <span className="team-spacer" />
          <Action
            size="sm"
            onClick={() => {
              setAuthOpen(false);
              setSelectedId(run.id);
            }}
          >
            {text("details")}
          </Action>
          {run.status === "failed" || run.status === "cancelled" ? (
            <Action
              size="sm"
              disabled={action.isPending}
              onClick={() => action.mutate({ run, retry: true })}
            >
              <RotateCcw size={14} />
              {text("retry")}
            </Action>
          ) : isActiveRun(run) ? (
            <Action
              size="sm"
              disabled={action.isPending}
              onClick={() => action.mutate({ run, retry: false })}
            >
              <Square size={13} />
              {text("stop")}
            </Action>
          ) : null}
        </div>
        <small>
          {new Date(run.started_at || run.created_at).toLocaleString()}{" "}
          {run.completed_at
            ? `· ${new Date(run.completed_at).toLocaleTimeString()}`
            : ""}
        </small>
        {run.status === "failed" && (
          <p role="status">
            {text(runFailureHint(run.error, run.failure_reason))}{" "}
            {needsModelAuth(run) && (
              <button
                className="team-text-action"
                onClick={() => {
                  setSelectedId(run.id);
                  setAuthOpen(true);
                }}
              >
                {text("modelSettings")}
              </button>
            )}
          </p>
        )}
        {isActiveRun(run) && <ExecutionStatus runs={[run]} hintOnly />}
        {inputs.length ? (
          <div className="team-run-links">
            <span>{text("runInput")}</span>
            {inputs.map((id) => {
              const entry = entries.find((e) => e.id === id);
              return (
                <button
                  className="team-text-action"
                  key={id}
                  disabled={!entry}
                  onClick={() => locate(`comment-${id}`)}
                >
                  {entry
                    ? `${entry.actor_name || people.name(entry.actor_id)}: ${entry.deleted_at ? text("deletedComment") : excerpt(entry)}`
                    : text("messageUnavailable")}
                </button>
              );
            })}
          </div>
        ) : (
          <p>{run.trigger_summary || text("noTriggerLink")}</p>
        )}
        <div className="team-run-links">
          <span>{text("runDelivery")}</span>
          {deliveries.map((entry) => (
            <div key={entry.id}>
              <button
                className="team-text-action"
                onClick={() => locate(`comment-${entry.id}`)}
              >
                <strong>{text("deliveryReply")}</strong>
                <span className="team-delivery-excerpt">
                  {failureForEntry(entry, [run])
                    ? text(runFailureHint(run.error, run.failure_reason))
                    : excerpt(entry)}
                </span>
              </button>
              {entry.attachments?.map((file) => (
                <button
                  className="team-file-link"
                  key={file.id}
                  onClick={() => locate(`artifact-${file.id}`)}
                >
                  <FileText size={14} />
                  {file.filename} · v
                  {findDeliverableVersion(outputs, file.id)?.version}
                </button>
              ))}
            </div>
          ))}
          {!deliveries.length && <small>{text("noLinkedDelivery")}</small>}
        </div>
      </article>
    );
  };
  if (!runs.length) return <Failure error={error} />;
  return (
    <section className="team-runs">
      <div className="team-toolbar">
        <h3>{text("runs")}</h3>
        <small>
          {text(active.length ? "currentRuns" : "latestRun")}{" "}
          {active.length || ""}
        </small>
      </div>
      <p>{text("runHint")}</p>
      <Failure error={action.error || error} />
      {featured.map(renderRun)}
      {!!history.length && (
        <details className="team-run-history">
          <summary>
            {text("runHistory")} · {history.length}
          </summary>
          {history.map(renderRun)}
        </details>
      )}
      {selected && (
        <Modal
          wide
          title={`${people.name(selected.agent_id)} · ${text("runs")}`}
          onClose={() => setSelectedId(null)}
        >
          <ExecutionStatus runs={[selected]} />
          <ExecutionStatus runs={[selected]} hintOnly />
          <Failure error={messages.error} />
          {selected.status === "failed" && (
            <p>
              {text(runFailureHint(selected.error, selected.failure_reason))}
            </p>
          )}
          <small>
            {new Date(
              selected.started_at || selected.created_at,
            ).toLocaleString()}
          </small>
          {entries
            .filter(
              (e) =>
                e.type === "comment" &&
                e.source_task_id === selected.id &&
                !e.deleted_at &&
                !failureForEntry(e, [selected]),
            )
            .map((e) => (
              <section className="team-context-preview" key={e.id}>
                <strong>{text("runDelivery")}</strong>
                <TeamMarkdown content={e.content || ""} />
              </section>
            ))}
          {needsModelAuth(selected) && (
            <>
              <Action onClick={() => setAuthOpen(!authOpen)}>
                {text("modelSettings")}
              </Action>
              {authOpen && <AgentAuthPanel agentId={selected.agent_id} />}
            </>
          )}
          <details>
            <summary>{text("executionLog")}</summary>
            <pre className="team-run-log">
              {selected.error}
              {"\n"}
              {JSON.stringify(messages.data || [], null, 2)}
            </pre>
          </details>
        </Modal>
      )}
    </section>
  );
}

function ProjectRunVersion({ run }: { run: AgentTask }) {
  const plan = run.project_plan;
  const versions = useTeamQuery(
    ["blueprint", plan?.project_id, "versions"],
    () => teamApi.listBlueprintVersions(plan!.project_id!),
    !!plan?.project_id,
  );
  const current = versions.data?.versions[0]?.number;
  return (
    <span className="project-run-version">
      {text("project.runVersion")} V{plan?.version}
      {current && current !== plan?.version
        ? ` · ${text("project.oldRunVersion")} V${current}`
        : ""}
    </span>
  );
}
