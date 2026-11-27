import { Progress } from "./progress";
import { useQuery } from "@tanstack/react-query";
import { CollapsibleMessage } from "./collapsible-message";
import { TaskProperties, TaskDetailMenu } from "./task-properties";
import { TaskFields } from "./task-fields";
import { DraftSchema, generatedDraftPatch, type TeamDraft } from "./draft";
import type { OpenworkServerClient } from "@/app/lib/openwork-server";

type PersonalSource = { title: string; description: string; client: OpenworkServerClient; workspaceId: string; sessionId: string };
import { ensureAgentAuth, runFailureHint } from "./model-auth";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Search, Columns3, Bot, Plus, ChevronLeft, ChevronRight, Pencil, FileText } from "../icons";
import { LayoutList } from "lucide-react";
import { canAssignAgentToIssue } from "@multica/core/permissions";
import { BUILT_IN_STATUS_ORDER } from "@multica/core/issues/config/status";
import type {
  Agent,
  UpdateIssueRequest,
  Issue,
  Attachment,
  Squad,
  ListIssuesParams,
  Project,
} from "@multica/core/types";
import { teamApi, text, useTeam, useTeamQuery, useTeamAction } from "./client";
import {
  Action,
  Field,
  Input,
  Textarea,
  Picker,
  SearchPicker,
  Failure,
  Empty,
  Modal,
  Status,
  Avatar,
} from "./ui";
import { IssueExecutionStatus } from "./execution-status";
import {
  locate,
  personalRuns,
  sharedTimeline,
  latestSquadFeedback,
} from "./relations";
import { TimelineComposer } from "./timeline";
import {
  splitProjectRequirements,
  joinProjectRequirements,
} from "./project-requirements";
import { TeamMarkdown } from "./markdown";
import {IssueFollowup, IssueRunHistory} from "./issue-followup";
import { SidebarResize, useSidebarWidth } from "../workbench/sidebar-resize";
import { SidePanel } from "./work-tools";
import { IssueSource } from "./rooms";
import { TaskProjectContext, TaskRequirements } from "./project-task-context";
import { TaskArtifacts, UploadFiles, RunList } from "./task-files";
export function useTeamPeople() {
  const { workspace, user } = useTeam();
  const agents = useTeamQuery(["agents"], () =>
    teamApi.listAgents({ workspace_id: workspace.id }),
  );
  const members = useTeamQuery(["members"], () =>
    teamApi.listMembers(workspace.id),
  );
  const squads = useTeamQuery(["squads"], () => teamApi.listSquads());
  const role = members.data?.find((m) => m.user_id === user.id)?.role || null;
  const allowed = (agent: Agent) =>
    canAssignAgentToIssue(agent, { userId: user.id, role }).allowed;
  const allowedSquad = (squad: Squad) => {
    const leader = agents.data?.find((agent) => agent.id === squad.leader_id);
    return !squad.archived_at && !!leader && allowed(leader);
  };
  const name = (id: string | null) =>
    agents.data?.find((a) => a.id === id)?.name ||
    members.data?.find((m) => m.user_id === id)?.name ||
    squads.data?.find((s) => s.id === id)?.name ||
    text(id ? "unknownPerson" : "unassigned");
  const options: {value:string;label:string;disabled?:boolean}[] = [
    { value: "none", label: text("unassigned") },
    ...(members.data || []).map((m) => ({
      value: `member:${m.user_id}`,
      label: `${m.name || m.email} · ${text("mentionMember")}`,
    })),
    ...(agents.data || []).map((a) => ({
      value: `agent:${a.id}`,
      label: `${a.name} · ${text("mentionAgent")}${allowed(a) ? "" : ` · ${text("noPermission")}`}`,
      disabled: !allowed(a),
    })),
  ];
  options.push(
    ...(squads.data || [])
      .filter((s) => !s.archived_at)
      .map((s) => ({
        value: `squad:${s.id}`,
        label: `${s.name} · ${text("mentionSquad")}${allowedSquad(s) ? "" : ` · ${text("noPermission")}`}`,
        disabled: !allowedSquad(s),
      })),
  );
  return {
    agents,
    members,
    squads,
    role,
    allowed,
    allowedSquad,
    name,
    options,
  };
}
export function useStatuses() {
  const catalog = useTeamQuery(["statuses"], () => teamApi.listIssueStatuses());
  const options =
    catalog.data?.statuses
      .filter((s) => !s.archived_at)
      .map((s) => ({
        value: s.key,
        label: s.is_system ? text(`status.${s.key}`) : s.name,
      })) ||
    BUILT_IN_STATUS_ORDER.map((s) => ({
      value: s,
      label: text(`status.${s}`),
    }));
  return { catalog, options };
}
export function NewTask({
  inline=false,
  onClose,
  onCreated,
  source,
  initialOwner,
  initialFields,
  draft: suppliedDraft,
  onDraftChange,
  onDiscard,
  onChangeWorkspace,
  followup,
}: {
  inline?: boolean;
  onClose: () => void;
  onCreated: (id: string, title: string) => void | Promise<void>;
  followup?: {
    project: Pick<Project, "id" | "title">;
    topicID: string;
    topicTitle: string;
    revision: number;
    conclusion: string;
  };
  source?: PersonalSource;
  draft?: TeamDraft;
  initialOwner?: string;
  initialFields?: Partial<Pick<TeamDraft,"status"|"priority"|"owner"|"projectID">>;
  onDraftChange?: (patch: Partial<TeamDraft>) => void;
  onDiscard?: () => void;
  onChangeWorkspace?: () => void;
}) {
  const { workspace, user } = useTeam();
  const people = useTeamPeople();
  const { options } = useStatuses();
  const [localDraft, setLocalDraft] = useState(() =>
    DraftSchema.parse({ projectID: followup?.project.id,owner:initialOwner, ...initialFields }),
  );
  const [continueCreating, setContinueCreating] = useState(false);
  const [requestID] = useState(() => crypto.randomUUID());
  const draft = suppliedDraft || localDraft;
  const update = (patch: Partial<TeamDraft>) =>
    onDraftChange
      ? onDraftChange(patch)
      : setLocalDraft((d) => ({ ...d, ...patch }));
  const { title, description, owner, status, mode, excerpts, files } = draft;
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [type, agentId] = owner.split(":");
  const artifacts = useQuery({
    queryKey: ["personalArtifacts", source?.workspaceId, source?.sessionId],
    queryFn: () =>
      source
        ? source.client.listArtifacts(source.workspaceId, source.sessionId)
        : Promise.resolve({ items: [] }),
    enabled: !!source,
  });
  const selectedArtifacts = (artifacts.data?.items || []).filter(
    (f) => !draft.excludedArtifacts.includes(f.id),
  );
  const generated = useQuery({
    queryKey: ["team", workspace.id, "taskDraft", draft.draftRequestID],
    enabled: !!draft.draftRequestID,
    queryFn: () => teamApi.getTaskDraft(draft.draftRequestID!),
    refetchInterval: (q) =>
      q.state.data &&
      ["succeeded", "failed", "cancelled"].includes(q.state.data.status)
        ? false
        : 2000,
  });
  const drafting =
    !!draft.draftRequestID &&
    !generated.error &&
    !["succeeded", "failed", "cancelled"].includes(
      generated.data?.status || "",
    );
  useEffect(() => {
    const patch = generatedDraftPatch(draft, generated.data);
    if (patch) update(patch);
  }, [draft, generated.data, update]);
  const generate = useTeamAction(async () => {
    const choice=draft.draftAgentID;
    const leader=choice.startsWith("squad:") ? people.squads.data?.find(s=>s.id===choice.slice(6))?.leader_id : choice;
    if(leader && leader!=="work" && !people.agents.data?.some(a=>a.id===leader && a.system_key==="mobilework")) await ensureAgentAuth(leader,user.id,workspace.id);
    const context = [
      draft.draftPrompt,
      source ? `${source.title}\n${source.description}` : "",
      ...excerpts,
    ]
      .filter(Boolean)
      .join("\n\n");
    const response = await teamApi.generateTaskDraft({
      request_id: crypto.randomUUID(),
      agent_id: draft.draftAgentID || "work",
      prompt: context,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      project_id: followup?.project.id || draft.projectID || undefined,
      topic_id: followup?.topicID,
      revision: followup?.revision,
    });
    update({
      draftRequestID: response.id,
      generated: false,
      draftConfirmed: false,
    });
  });
  const quick = useQuery({
    queryKey: ["team", workspace.id, "quickResult", draft.pendingTaskId],
    enabled: !!draft.pendingTaskId && !!draft.pendingAgentId,
    queryFn: async () => {
      let before: string | undefined;
      do {
        const page = await teamApi.listAgentTasksPage(draft.pendingAgentId!, {
          before,
        });
        const task = page.tasks.find((t) => t.id === draft.pendingTaskId);
        if (task) return task;
        before = page.nextCursor || undefined;
      } while (before);
      throw new Error(text("quickResultMissing"));
    },
    refetchInterval: (q) =>
      q.state.data &&
      ["completed", "failed", "cancelled"].includes(q.state.data.status)
        ? false
        : 2000,
  });
  const link = useTeamAction(async (issue: { id: string; title: string }) => {
    update({ created: issue });
    await onCreated(issue.id, issue.title);
  });
  const quickIssue = useTeamQuery(
    ["quickIssue", quick.data?.issue_id],
    () => teamApi.getIssue(quick.data!.issue_id),
    !!quick.data?.issue_id,
  );
  const linked = useRef("");
  useEffect(() => {
    if (
      !quickIssue.data ||
      linked.current === quickIssue.data.id ||
      draft.created
    )
      return;
    linked.current = quickIssue.data.id;
    link.mutate({ id: quickIssue.data.id, title: quickIssue.data.title });
  }, [quickIssue.data, draft.created]);
  const action = useTeamAction(async () => {
    if (draft.created) return onCreated(draft.created.id, draft.created.title);
    const uploaded = { ...draft.uploadedArtifacts };
    const selectedFiles = [...files];
    if (source)
      for (const file of selectedArtifacts) {
        const version = JSON.stringify([file.id, file.updatedAt, file.size]);
        if (!uploaded[version]) {
          const data = await source.client.downloadArtifact(
            source.workspaceId,
            file.id,
            source.sessionId,
          );
          uploaded[version] = await teamApi.uploadFile(
            new File(
              [data.data],
              file.name ||
                file.path?.split(/[\\/]/).pop() ||
                data.filename ||
                file.id,
              {
                type:
                  file.mime || data.contentType || "application/octet-stream",
              },
            ),
          );
          update({ uploadedArtifacts: { ...uploaded } });
        }
        selectedFiles.push(uploaded[version]);
      }
    const context = [
      description.trim(),
      source
        ? `### ${text("sourceTask")}\n\n${source.title}\n\n${source.description}`
        : "",
      ...excerpts
        .filter((s) => s.trim())
        .map((s) => `### ${text("sharedExcerpt")}\n\n${s}`),
    ]
      .filter(Boolean)
      .join("\n\n");
    const attachment_ids = [...new Set(selectedFiles.map((f) => f.id))];
    if (followup) {
      await teamApi.createTopicFollowup(followup.project.id, followup.topicID, {
        request_id: requestID,
        revision: followup.revision,
        kind: "create",
        title: title.trim(),
        description: context,
        status,
        due_date: draft.dueDate,
        assignee_type: type === "none" ? "" : type,
        assignee_id: agentId || "",
        attachment_ids,
      });
      await onCreated("", title.trim());
      return;
    }
    const issue = await teamApi.createIssue({
      suppress_run: true,
      title: title.trim(),
      description: context,
      status,
      attachment_ids,
      priority: draft.priority,
      start_date: draft.startDate || undefined,
      ...{label_names: draft.labels.split(/[,，]/).map(s=>s.trim()).filter(Boolean)},
      due_date: draft.dueDate || undefined,
      project_id: draft.projectID || undefined,
      ...(type === "agent" || type === "member" || type === "squad"
        ? { assignee_type: type, assignee_id: agentId }
        : {}),
    });
    if (continueCreating && !source && !followup) {
      setLocalDraft(DraftSchema.parse({projectID:draft.projectID,owner:initialOwner,...initialFields}));
      return;
    }
    update({ created: { id: issue.id, title: issue.title } });
    await onCreated(issue.id, issue.title);
  });
  const busy =
    action.isPending || link.isPending || generate.isPending || uploading;
  const close = () => {
    if (!busy) onClose();
  };
  const body = <>
      {draft.created ? (
        <>
          <p>{text("createdLinkPending")}</p>
          <Failure error={action.error || link.error} />
          <Action disabled={busy} onClick={() => action.mutate()}>
            {text("retryLink")}
          </Action>
        </>
      ) : draft.pendingTaskId ? (
        <>
          <p role="status">
            {text(
              quick.data?.status === "failed" ||
                quick.data?.status === "cancelled"
                ? "quickFailed"
                : quick.data?.status === "completed" && !quick.data.issue_id
                  ? "quickUnconfirmed"
                  : "quickSubmitted",
            )}
          </p>
          <Failure
            error={quick.error || quickIssue.error}
            retry={() => {
              void quick.refetch();
              if (quick.data?.issue_id) void quickIssue.refetch();
            }}
          />
          {quick.data?.error && (
            <p>
              {text(
                runFailureHint(quick.data.error, quick.data.failure_reason),
              )}
            </p>
          )}
          <Action onClick={() => void quick.refetch()}>
            {text("refresh")}
          </Action>
          {quick.data &&
            ["failed", "cancelled", "completed"].includes(quick.data.status) &&
            !quick.data.issue_id && (
              <Action
                onClick={() =>
                  update({
                    pendingTaskId: undefined,
                    pendingAgentId: undefined,
                  })
                }
              >
                {text("back")}
              </Action>
            )}
          <Action onClick={close}>{text("close")}</Action>
        </>
      ) : (
        <>
          <div className="team-toolbar">
            <small>
              {workspace.name}
              {source ? ` · ${text("draftSaved")}` : ""}
            </small>
            {onChangeWorkspace && (
              <Action size="sm" disabled={busy} onClick={onChangeWorkspace}>
                {text("changeWorkspace")}
              </Action>
            )}
          </div>
          <fieldset disabled={busy} className="team-create-fields">
            <div className="team-filter team-create-tabs">
              {["manual", "agent"].map((m) => (
                <button
                  key={m}
                  disabled={drafting || generate.isPending}
                  className={mode === m ? "active" : ""}
                  onClick={() =>
                    update({
                      mode: m === "agent" ? "agent" : "manual",
                      draftPrompt: draft.draftPrompt || description,
                    })
                  }
                >
                  {text(`create.${m}`)}
                </button>
              ))}
            </div>
            {followup && (
              <section className="team-context-preview">
                <strong>
                  {followup.project.title} · {followup.topicTitle} ·{" "}
                  {text("project.sourceVersions")} V{followup.revision}
                </strong>
                <CollapsibleMessage content={followup.conclusion} />
              </section>
            )}
            {mode === "agent" && (
              <section className="team-draft-generation">
                <Field label={text("draftPrompt")}>
                  <Textarea
                    autoFocus
                    rows={5}
                    maxLength={12000}
                    value={draft.draftPrompt}
                    placeholder={text("draftPromptPlaceholder")}
                    disabled={drafting || generate.isPending}
                    onChange={(e) =>
                      update({
                        draftPrompt: e.target.value,
                        draftRequestID: undefined,
                        generated: false,
                        draftConfirmed: false,
                      })
                    }
                  />
                </Field>
                <div className="team-draft-controls">
                  <Field label={text("draftAssistant")}>
                    <Picker
                      label={text("draftAssistant")}
                      disabled={drafting || generate.isPending}
                      value={draft.draftAgentID || "work"}
                      options={[
                        { value: "work", label: "Work" },
                        ...(people.agents.data || []).filter(a=>a.system_key!=="mobilework").map((a) => ({
                          value: a.id,
                          label: a.name,
                          disabled: !people.allowed(a),
                        })),
                        ...(people.squads.data||[]).filter(s=>!s.archived_at).map(s=>({value:"squad:"+s.id,label:s.name+" · 小队",disabled:!people.allowedSquad(s)})),
                      ]}
                      onChange={(draftAgentID) => update({ draftAgentID })}
                    />
                  </Field>
                  <Action
                    primary
                    disabled={
                      busy ||
                      !draft.draftPrompt.trim() ||
                      drafting
                    }
                    onClick={() => generate.mutate()}
                  >
                    {text(
                      draft.generated
                        ? "regenerateTaskDraft"
                        : "generateTaskDraft",
                    )}
                  </Action>
                </div>
                <p className="team-draft-hint">{text("draftGenerationHint")}</p>
                {(generate.isPending || draft.draftRequestID) && (
                  <Progress active={generate.isPending || drafting}>
                    {text(
                      generate.isPending
                        ? "draftStatus.submitting"
                        : generated.error
                          ? "draftStatus.unavailable"
                          : `draftStatus.${generated.data?.status || "queued"}`,
                    )}
                  </Progress>
                )}
                <Failure
                  error={generate.error || generated.error}
                  retry={() => void generated.refetch()}
                />
                {generated.data?.error && (
                  <p role="alert">{text("draftGenerationFailed")}</p>
                )}
                {!!generated.data?.draft?.questions.length &&
                  generated.data.status === "succeeded" && (
                    <div className="team-draft-questions" role="status">
                      <strong>{text("draftQuestions")}</strong>
                      <ul>
                        {generated.data.draft.questions.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </section>
            )}
            {(mode === "manual" || draft.generated) && (
              <section className="team-draft-fields">
                {mode === "agent" && (
                  <div className="team-draft-review">
                    <strong>{text("draftReview")}</strong>
                    <span>{text("draftReviewHint")}</span>
                  </div>
                )}
                <TaskFields
                  draft={draft}
                  update={(patch) =>
                    update({
                      ...patch,
                      ...("owner" in patch || "dueDate" in patch
                        ? { draftConfirmed: false }
                        : {}),
                    })
                  }
                  owners={people.options}
                  statuses={options}
                  project={followup?.project}
                  onUploading={setUploading}
                  onUploadFailure={setUploadFailed}
                />
                {draft.generated && mode === "agent" && (
                  <label className="team-material-row">
                    <input
                      type="checkbox"
                      checked={draft.draftConfirmed}
                      onChange={(e) =>
                        update({ draftConfirmed: e.target.checked })
                      }
                    />
                    {text("confirmDraftArrangement")}
                  </label>
                )}
              </section>
            )}
            {source && (
              <section className="team-context-preview">
                <strong>{text("contextPreview")}</strong>
                <p>{text("shareBoundary")}</p>
                <details>
                  <summary>
                    {text("sourceTask")} · {source.title}
                  </summary>
                  <p className="team-preserve-text">
                    {source.description || text("noSourceDescription")}
                  </p>
                </details>
                <strong>
                  {text("sourceArtifacts")} · {selectedArtifacts.length}/
                  {artifacts.data?.items.length || 0}
                </strong>
                {artifacts.isPending && <p>{text("loading")}</p>}
                <Failure
                  error={artifacts.error}
                  retry={() => void artifacts.refetch()}
                />
                {artifacts.data?.items.map((f) => (
                  <label className="team-material-row" key={f.id}>
                    <input
                      type="checkbox"
                      checked={!draft.excludedArtifacts.includes(f.id)}
                      onChange={(e) =>
                        update({
                          excludedArtifacts: e.target.checked
                            ? draft.excludedArtifacts.filter(
                                (id) => id !== f.id,
                              )
                            : [...draft.excludedArtifacts, f.id],
                        })
                      }
                    />
                    <span>
                      {f.name || f.path?.split(/[\\/]/).pop() || f.id}
                    </span>
                    <small>
                      {f.size == null ? "" : `${(f.size / 1024).toFixed(1)} KB`}
                    </small>
                  </label>
                ))}
                {artifacts.data?.items.length === 0 && (
                  <p>{text("noSourceArtifacts")}</p>
                )}
                {excerpts.map((value, index) => (
                  <div className="team-excerpt-editor" key={index}>
                    <Field label={`${text("sharedExcerpt")} ${index + 1}`}>
                      <Textarea
                        value={value}
                        onChange={(e) =>
                          update({
                            excerpts: excerpts.map((v, n) =>
                              n === index ? e.target.value : v,
                            ),
                          })
                        }
                      />
                    </Field>
                    <Action
                      size="sm"
                      onClick={() =>
                        update({
                          excerpts: excerpts.filter((_, n) => n !== index),
                        })
                      }
                    >
                      {text("removeExcerpt")}
                    </Action>
                  </div>
                ))}
              </section>
            )}
          </fieldset>
          <Failure
            error={action.error || people.agents.error || people.squads.error}
          />
          <div className="team-create-footer">
            <p className="team-trigger-hint">{text("createNoStart")}</p>
            <div className="team-actions">
              {!source && !followup && <label><input type="checkbox" checked={continueCreating} onChange={e=>setContinueCreating(e.target.checked)}/>继续创建</label>}
              {onDiscard && (
                <Action disabled={busy} onClick={onDiscard}>
                  {text("discardDraft")}
                </Action>
              )}
              <span className="team-spacer" />
              <Action
                primary
                disabled={
                  busy || uploadFailed || (!!draft.dueDate && draft.startDate > draft.dueDate) ||
                  !title.trim() ||
                  (mode === "agent" &&
                    (!draft.generated || !draft.draftConfirmed)) ||
                  (!!source && (artifacts.isPending || !!artifacts.error))
                }
                onClick={() => action.mutate()}
              >
                {text(busy ? "working" : "createTask")}
              </Action>
            </div>
          </div>
        </>
      )}
    </>;
  if(inline) return <section className="wb-home-task" aria-label="新建任务">
    <header><div className="wb-home-tabs"><button type="button" onClick={close}>会话</button><button type="button" aria-pressed="true">任务</button></div>
    <span>创建者　{user.name}</span><Action disabled={busy||drafting} onClick={()=>update({mode:mode==="agent"?"manual":"agent",draftPrompt:draft.draftPrompt||description})} aria-label={mode==="agent"?"切换到手动":"切换到智能体"}>{mode==="agent"?"智能体":"手动"}</Action></header>
    {body}</section>;
  return <Modal title={text(followup ? "project.followup.create" : "newTask")} onClose={close} wide className="team-create-modal">{body}</Modal>;
}
export function TaskDetail({ id }: { id: string }) {
  const location = useLocation();
  const [detailParams] = useSearchParams();
  const sourceRoute =
    typeof location.state?.personalSourceRoute === "string" &&
    /^\/(session(?:\/|$)|workspace\/[^/]+\/session(?:\/|$))/.test(
      location.state.personalSourceRoute,
    )
      ? location.state.personalSourceRoute
      : null;
  const { workspace, user } = useTeam();
  const navigate = useNavigate();
  const people = useTeamPeople();
  const { options } = useStatuses();
  const subscribers = useTeamQuery(["subscribers", id], () =>
    teamApi.listIssueSubscribers(id),
  );
  const commentFile = useRef<HTMLInputElement>(null);
  const [chatIssueId, setChatIssueId] = useState("");
  const chatOpen = chatIssueId === id;
  const chatWidth = useSidebarWidth("right", "task-chat");
  useEffect(() => { setChatIssueId(""); }, [id]);
  const [followupPanel, setFollowupPanel] = useState("");
  const [showSubscribers, setShowSubscribers] = useState(false);
  const changeSubscriber = useTeamAction(async ({id: memberId, add}: {id: string; add: boolean}) => {
    if (add) await teamApi.subscribeToIssue(id, memberId, "member");
    else await teamApi.unsubscribeFromIssue(id, memberId, "member");
    await subscribers.refetch();
  });
  const subscribed = subscribers.data?.some(
    (s) => s.user_type === "member" && s.user_id === user.id,
  );
  const subscribe = useTeamAction(async () =>
    subscribed
      ? teamApi.unsubscribeFromIssue(id)
      : teamApi.subscribeToIssue(id),
  );
  const issue = useTeamQuery(["issue", id], () => teamApi.getIssue(id));
  const sourceProject = useTeamQuery(
    ["project", issue.data?.project_id],
    () => teamApi.getProject(issue.data!.project_id!),
    !!issue.data?.project_id,
  );
  const timeline = useTeamQuery(["timeline", id], () =>
    teamApi.listTimeline(id),
  );
  const attachments = useTeamQuery(["attachments", id], () =>
    teamApi.listAttachments(id),
  );
  const runs = useTeamQuery(["runs", id], () => teamApi.listTasksByIssue(id));
  const notices = useTeamQuery(["inbox", false], () => teamApi.listInbox());
  const notice = notices.data?.find(
    (item) => item.issue_id === id && !item.read && item.details?.comment_id,
  );
  const readNotice = useTeamAction(async (noticeId: string) =>
    teamApi.markInboxRead(noticeId),
  );
  const [params] = useSearchParams();
  const highlightCommentId = params.get("comment");
  const locatedComment = useRef<string | null>(null);
  useEffect(() => {
    if (!highlightCommentId) {
      locatedComment.current = null;
      return;
    }
    if (highlightCommentId !== locatedComment.current && issue.data && timeline.data &&
        locate(`comment-${highlightCommentId}`)) {
      locatedComment.current = highlightCommentId;
    }
  }, [highlightCommentId, issue.data?.id, timeline.data]);
  const [edit, setEdit] = useState(false);
  const [editingTitle,setEditingTitle] = useState(false);
  const [editingRevision,setEditingRevision] = useState<number>();
  const discardTitle=useRef(false);
  const [editingBody,setEditingBody] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectRequirements, setProjectRequirements] = useState<string | null>(
    null,
  );
  const update = useTeamAction(
    async ({patch}: {patch: UpdateIssueRequest}) => {
      await teamApi.updateIssue(id, {expected_revision: issue.data?.revision, ...patch, suppress_run: true});
      setEdit(false);setEditingTitle(false);setEditingBody(false);
    },
  );
  useEffect(() => {
    const topic = issue.data?.metadata.project_topic_id,
      project = issue.data?.metadata.topic_project_id;
    if (typeof topic === "string" && typeof project === "string")
      navigate(
        `/team/${workspace.slug}?view=projects&project=${project}&section=overview`,
        { replace: true },
      );
  }, [issue.data?.metadata, navigate, workspace.slug]);
  useEffect(() => {
    const data = issue.data;
    if (location.state?.editTask !== id || data?.id !== id) return;
    const parts = splitProjectRequirements(data.description || "");
    setTitle(data.title); setDescription(parts.description); setProjectRequirements(parts.requirements);
    setEditingRevision(data.revision); setEdit(true);
    navigate(location.pathname + location.search, {replace:true,state:{...location.state,editTask:undefined}});
  }, [id, issue.data, location, navigate]);
  if (!issue.data)
    return (
      <>
        <Failure error={issue.error} retry={() => void issue.refetch()} />
        <Empty>{text("loading")}</Empty>
      </>
    );
  const item = issue.data;
  const visibleRuns = personalRuns(runs.data || [], user.id);
  const visibleEntries = sharedTimeline(timeline.data || [], visibleRuns);
  const squadFeedback = latestSquadFeedback(visibleEntries);
  const base = "/team/" + workspace.slug;
  const listUrl = base+"?"+(location.state?.taskListSearch || "view=tasks");
  const projectUrl = base+"?view=projects&project="+item.project_id;
  const fromProject = !!item.project_id && detailParams.has("project");
  const beginDescription = () => {
    setEditingRevision(item.revision);
    const parts = splitProjectRequirements(item.description || "");
    setDescription(parts.description);setProjectRequirements(parts.requirements);
  };
  const editIssue = () => { setTitle(item.title);beginDescription();setEdit(true); };
  const saveBody = () => update.mutate({patch:{expected_revision:editingRevision,description:joinProjectRequirements(description,projectRequirements),description_base:item.description||""}});
  const taskIds = (location.state?.taskIds || []) as string[];
  const runAgent = item.assignee_type === "agent" ? item.assignee_id : item.assignee_type === "squad"
    ? people.squads.data?.find(s => s.id === item.assignee_id && !s.archived_at)?.leader_id : null;
  const canRun = !!runAgent && !!people.agents.data?.some(a => a.id === runAgent && !a.archived_at && people.allowed(a));
  return (
    <section className="v3-issue-detail" aria-label="任务详情">
      <nav className="v3-issue-toolbar">
        <button aria-label={fromProject?"返回项目":"返回看板"} onClick={()=>navigate(fromProject?projectUrl+"&section="+(detailParams.get("section")||"tasks"):listUrl)}><ChevronLeft size={17}/></button>
        <span className="v3-issue-breadcrumb">{sourceProject.data?.title || "任务"}<ChevronRight size={12}/>{item.identifier} {item.title}</span>
        {sourceRoute && <button onClick={()=>navigate(sourceRoute)}>{text("backToPersonal")}</button>}
        {fromProject && <button onClick={()=>navigate(listUrl)}>返回任务列表</button>}
        {item.project_id && <button onClick={()=>navigate(projectUrl+"&section=blueprint")}>查看项目计划</button>}
        {[-1,1].map(offset=>{
          const index=taskIds.indexOf(id),adjacent=index>=0?taskIds[index+offset]:null;
          return <button key={offset} aria-label={offset<0?"上一个任务":"下一个任务"} disabled={!adjacent} onClick={()=>navigate(base+"/issue/"+adjacent+location.search,{state:location.state})}>
            {offset<0?<ChevronLeft size={15}/>:<ChevronRight size={15}/>}</button>
        })}
        <button className="v3-mobile-side-chat" aria-label="发起会话" onClick={() => setChatIssueId(id)}><Bot size={17}/></button>
        <TaskDetailMenu issue={item} onEdit={editIssue} onWake={()=>setFollowupPanel(item.assignee_type === "agent" || item.assignee_type === "squad" ? "wake" : "schedule")}
          onCopy={copy=>navigate(`/team/${workspace.slug}/issue/${copy}`)}
        onDelete={()=>navigate(item.project_id && detailParams.has("project") ? `/team/${workspace.slug}?view=projects&project=${item.project_id}&section=tasks` : `/team/${workspace.slug}?${location.state?.taskListSearch || "view=tasks"}`)}/>
      </nav>
      <Failure
        error={
          update.error ||
          timeline.error ||
          attachments.error ||
          subscribe.error ||
          subscribers.error ||
          people.squads.error
        }
      />
      {notice && (
        <button
          className="team-new-replies"
          onClick={() => {
            if (notice.details?.comment_id)
              locate(`comment-${notice.details.comment_id}`);
            readNotice.mutate(notice.id);
          }}
        >
          {text("newReplies")}
        </button>
      )}
      <div className="v3-issue-columns" data-chat-open={chatOpen} style={chatOpen && chatWidth.width ? {"--task-chat-width":chatWidth.width+"px"} as CSSProperties : undefined}>
        <div className="v3-issue-main"><TimelineComposer key={item.id} heading="动态" runs={visibleRuns} issue={item} entries={visibleEntries} people={people} fileInput={commentFile}
          subscription={<div className="v3-subscribers">
            <button aria-pressed={!!subscribed} disabled={!subscribers.data || subscribe.isPending} onClick={() => subscribe.mutate()}>{subscribed ? "取消订阅" : "订阅"}</button>
            <button aria-label="任务订阅者" aria-expanded={showSubscribers} onClick={() => setShowSubscribers(!showSubscribers)}>＋</button>
            {showSubscribers && <fieldset><legend>任务订阅者</legend>
              {people.members.data?.map(m => <label key={m.user_id}><input type="checkbox"
                disabled={!subscribers.data || changeSubscriber.isPending}
                checked={!!subscribers.data?.some(s=>s.user_type==="member" && s.user_id===m.user_id)}
                onChange={e=>changeSubscriber.mutate({id:m.user_id,add:e.target.checked})}/>{m.name || m.email}</label>)}
              <Failure error={changeSubscriber.error || people.members.error}/>
              <button onClick={()=>setShowSubscribers(false)}>关闭</button>
            </fieldset>}
          </div>}>
          <div className="v3-issue-id"><FileText size={13}/>任务 <small>{item.identifier}</small></div>
          {editingTitle ? <Input aria-label="编辑任务标题" autoFocus value={title} onChange={e=>setTitle(e.target.value)}
            onKeyDown={e=>{
              if(e.nativeEvent.isComposing)return;
              if(e.key==="Enter")e.currentTarget.blur();
              if(e.key==="Escape"){e.preventDefault();discardTitle.current=true;setEditingTitle(false);}
            }}
            onBlur={()=>{if(discardTitle.current)return;const next=title.trim();if(next && next!==item.title)update.mutate({patch:{title:next,title_base:item.title,expected_revision:editingRevision}});else setEditingTitle(false);}}/>
            : <h1><button onClick={()=>{discardTitle.current=false;setEditingRevision(item.revision);setTitle(item.title);setEditingTitle(true);}}>{item.title}</button></h1>}
          <section className="v3-issue-brief">
            {editingBody ? <><Textarea aria-label="编辑任务描述" value={description} onChange={e=>setDescription(e.target.value)}/>
              <Action onClick={()=>setEditingBody(false)}>取消</Action><Action primary disabled={update.isPending} onClick={saveBody}>保存描述</Action></>
              : <><TaskRequirements issue={item}/><button aria-label="编辑任务描述" onClick={()=>{beginDescription();setEditingBody(true)}}><Pencil size={14}/></button></>}
            <div className="team-input-files">
              {attachments.data
                ?.filter((a) => !a.comment_id)
                .map((a) => (
                  <span key={a.id}>
                    <FileText size={14} />
                    {a.filename}
                  </span>
                ))}
            </div>
          </section>
          <IssueFollowup issue={item} part="links" onAttach={() => commentFile.current?.click()}/>
          <TaskProjectContext issue={item} />
          {squadFeedback && (
            <section className="team-squad-feedback">
              <div className="team-toolbar">
                <h3>
                  {text(
                    item.status === "in_review"
                      ? "squadDelivery"
                      : "squadFeedback",
                  )}
                </h3>
                <Action
                  size="sm"
                  onClick={() => locate(`comment-${squadFeedback.id}`)}
                >
                  {text("viewProcess")}
                </Action>
              </div>
              <small>
                {squadFeedback.actor_name ||
                  people.name(squadFeedback.actor_id)}{" "}
                · {new Date(squadFeedback.created_at).toLocaleString()}
              </small>
              <TeamMarkdown content={squadFeedback.content || ""} />
            </section>
          )}
          </TimelineComposer>
        </div>
        <aside id="v3-task-detail-rail" className="v3-issue-inspector">
          {chatOpen && <>
            <SidebarResize side="right" controls="v3-task-detail-rail" label="调整任务聊天宽度" setWidth={chatWidth.setWidth} save={chatWidth.save}/>
            <SidePanel key={id} ws={workspace.id} kind="issue" issue={item} id={id} close={() => setChatIssueId("")}/>
          </>}
          <Action aria-label="发起会话" onClick={() => setChatIssueId(id)}>
            <Bot size={18}/><span>发起会话<small>与 Work 临时讨论，关闭后清空</small></span><Plus size={15}/>
          </Action>
          <IssueSource id={item.id}/>
          <section className="v3-issue-fields"><h2>属性</h2>
          <Field label="状态">
            <Picker
              label={text("state")}
              value={item.status}
              options={options}
              onChange={(v) => update.mutate({ patch: { status: v } })}
              disabled={update.isPending}
            />
          </Field>
          <Field label={text("owner")}>
            <Picker
              label={text("owner")}
              value={
                item.assignee_id
                  ? `${item.assignee_type}:${item.assignee_id}`
                  : "none"
              }
              options={people.options}
              selectedLabel={item.assignee_id ? people.name(item.assignee_id) : "无负责人"}
              onChange={(v) => {
                const [type, ownerId] = v.split(":");
                update.mutate({
                  patch: {
                    assignee_type:
                      type === "agent"
                        ? "agent"
                        : type === "member"
                          ? "member"
                          : type === "squad"
                            ? "squad"
                            : null,
                    assignee_id: ownerId || null,
                  },
                });
              }}
              disabled={update.isPending}
            />
          </Field>
          </section>
          <TaskProperties issue={item}/>
          <details><summary>唤醒与提醒</summary><IssueFollowup issue={item} part="actions" activePanel={followupPanel} onPanelChange={setFollowupPanel}/></details>
          <details><summary>执行日志</summary>
          <Action disabled={!canRun}
            onClick={() => setFollowupPanel("run")}>运行智能体</Action>
          <IssueRunHistory issueId={id} canRun={canRun} onRetry={()=>setFollowupPanel("run")}/>
          <IssueExecutionStatus runs={visibleRuns}/>
          <RunList
            issueId={id}
            people={people}
            runs={visibleRuns}
            error={runs.error}
            entries={visibleEntries}
          />
          <section aria-label="任务产物与输入材料">
          <TaskArtifacts
            runs={visibleRuns}
            entries={visibleEntries}
            inputs={attachments.data?.filter((a) => !a.comment_id) || []}
          />
          </section>
          </details>
        </aside>
      </div>
      {edit && (
        <Modal title={text("editTask")} onClose={() => setEdit(false)}>
          <Field label={text("taskTitle")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={text("requirements")}>
            <Textarea
              rows={10}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          {projectRequirements !== null && (
            <Field label={text("project.requirements")}>
              <Textarea
                rows={5}
                value={projectRequirements}
                onChange={(e) => setProjectRequirements(e.target.value)}
              />
            </Field>
          )}
          <Failure error={update.error} />
          <Action
            primary
            disabled={update.isPending || !title.trim()}
            onClick={() =>
              update.mutate({
                patch: {
                  title,
                  title_base: item.title,
                  expected_revision: editingRevision,
                  description: joinProjectRequirements(
                    description,
                    projectRequirements,
                  ),
                  description_base: item.description || "",
                },
              })
            }
          >
            {text("save")}
          </Action>
        </Modal>
      )}
    </section>
  );
}
