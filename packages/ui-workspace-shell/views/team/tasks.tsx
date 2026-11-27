import { Progress } from "./progress";
import { useQuery } from "@tanstack/react-query";
import { CollapsibleMessage } from "./collapsible-message";
import { TaskFields } from "./task-fields";
import { DraftSchema, generatedDraftPatch, type TeamDraft } from "./draft";
import type { OpenworkServerClient } from "@/app/lib/openwork-server";

type PersonalSource = { title: string; description: string; client: OpenworkServerClient; workspaceId: string; sessionId: string };
import { ensureAgentAuth, runFailureHint } from "./model-auth";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  Search,
  LayoutList,
  Columns3,
  ArrowLeft,
  FileText,
} from "lucide-react";
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
  const options = [
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
export function TaskList() {
  const { workspace, user } = useTeam();
  const navigate = useNavigate();
  const people = useTeamPeople();
  const { options } = useStatuses();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "",
    filter = params.get("scope") || "all";
  const projectID = params.get("project") || "",
    statusFilter = params.get("status") || "",
    ownerFilter = params.get("owner") || "";
  const sort =
    params.get("sort") === "updated_at"
      ? "updated_at"
      : params.get("sort") === "due_date"
        ? "due_date"
        : "created_at";
  const direction = params.get("direction") === "asc" ? "asc" : "desc";
  const page = Math.max(0, Number(params.get("page")) || 0),
    board = params.get("taskView") === "board";
  const setFilterValue = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  };
  const setPage = (n: number) => setFilterValue("page", String(n));
  const setBoard = (value: boolean) =>
    setFilterValue("taskView", value ? "board" : "");
  const projects = useTeamQuery(["projects"], () => teamApi.listProjects());
  const snapshot = useTeamQuery(["taskSnapshot"], () =>
    teamApi.getAgentTaskSnapshot(),
  );
  const query: ListIssuesParams = {
    workspace_id: workspace.id,
    q: search,
    ...(statusFilter ? { statuses: [statusFilter] } : {}),
    ...(ownerFilter === "none"
      ? { include_no_assignee: true }
      : ownerFilter
        ? { assignee_ids: [ownerFilter] }
        : {}),
    ...(projectID === "none"
      ? { include_no_project: true }
      : projectID
        ? { project_id: projectID }
        : {}),
  };
  const scopeQuery = (scope: string): ListIssuesParams => ({
    ...query,
    ...(scope === "mine"
      ? { assignee_id: user.id }
      : scope === "created"
        ? { creator_id: user.id }
        : {}),
  });
  const issues = useTeamQuery(
    ["issues", query, filter, page, sort, direction],
    () =>
      teamApi.listIssues({
        ...scopeQuery(filter),
        limit: 50,
        offset: page * 50,
        sort_by: sort,
        sort_direction: direction,
      }),
  );
  const counts = useTeamQuery(
    ["issues", "counts", query, user.id],
    async () => {
      const [all, mine, created] = await Promise.all(
        ["all", "mine", "created"].map((scope) =>
          teamApi.listIssues({ ...scopeQuery(scope), limit: 1 }),
        ),
      );
      return { all: all.total, mine: mine.total, created: created.total };
    },
  );
  const notices = useTeamQuery(["inbox", false], () => teamApi.listInbox());
  const updated = new Set(
    notices.data?.filter((item) => !item.read).map((item) => item.issue_id),
  );
  const visibleRuns = personalRuns(snapshot.data || [], user.id);
  const open = (issue: Issue) =>
    navigate(`/team/${workspace.slug}/issue/${issue.id}`, {
      state: { taskListSearch: params.toString() },
    });
  return (
    <>
      <div className="team-toolbar">
        <div>
          <h1>{text("teamTasks")}</h1>
          <p>{text("tasksHint")}</p>
        </div>
        <div className="team-actions">
          <Action aria-label={text("list")} onClick={() => setBoard(false)}>
            <LayoutList />
          </Action>
          <Action aria-label={text("board")} onClick={() => setBoard(true)}>
            <Columns3 />
          </Action>
        </div>
      </div>
      <div className="team-toolbar">
        <div className="team-filter">
          {(["all", "mine", "created"] as const).map((v) => (
            <button
              key={v}
              className={v === filter ? "active" : ""}
              onClick={() => {
                setFilterValue("scope", v);
              }}
            >
              {text(v)} <small>{counts.data?.[v] ?? "—"}</small>
            </button>
          ))}
        </div>
        <div className="team-search">
          <Search size={16} />
          <Input
            aria-label={text("search")}
            placeholder={text("search")}
            value={search}
            onChange={(e) => {
              setFilterValue("q", e.target.value);
            }}
          />
        </div>
      </div>
      <div className="team-task-filters">
        <div
          className="team-task-filter-group"
          role="group"
          aria-label={text("filters")}
        >
          <Field label={text("taskProject")}>
            <SearchPicker
              label={text("taskProject")}
              value={projectID}
              onChange={(v) => setFilterValue("project", v)}
              options={[
                { value: "", label: text("allProjects") },
                { value: "none", label: text("noProject") },
                ...(projects.data?.projects || []).map((p) => ({
                  value: p.id,
                  label: p.title,
                })),
              ]}
            />
          </Field>
          <Field label={text("state")}>
            <Picker
              label={text("state")}
              value={statusFilter}
              onChange={(v) => setFilterValue("status", v)}
              options={[{ value: "", label: text("allStates") }, ...options]}
            />
          </Field>
          <Field label={text("owner")}>
            <Picker
              label={text("owner")}
              value={ownerFilter}
              onChange={(v) => setFilterValue("owner", v)}
              options={[
                { value: "", label: text("allOwners") },
                ...people.options.map((o) => ({
                  value: o.value === "none" ? "none" : o.value.split(":")[1],
                  label: o.label.replace(` · ${text("noPermission")}`, ""),
                })),
              ]}
            />
          </Field>
        </div>
        <div
          className="team-task-sort-group"
          role="group"
          aria-label={text("sorting")}
        >
          <Field label={text("sortBy")}>
            <Picker
              label={text("sortBy")}
              value={sort}
              onChange={(v) => setFilterValue("sort", v)}
              options={["created_at", "updated_at", "due_date"].map(
                (value) => ({
                  value,
                  label: text(`sort.${value}`),
                }),
              )}
            />
          </Field>
          <Field label={text("sortDirection")}>
            <Picker
              label={text("sortDirection")}
              value={direction}
              onChange={(v) => setFilterValue("direction", v)}
              options={["desc", "asc"].map((value) => ({
                value,
                label: text(
                  `sort.${sort === "due_date" ? "due." : ""}${value}`,
                ),
              }))}
            />
          </Field>
        </div>
        <Action
          onClick={() => {
            setParams({ view: "tasks", ...(board ? { taskView: "board" } : {}) }, { replace: true });
          }}
        >
          {text("clearFilters")}
        </Action>
      </div>
      <p role="status">
        {text("matchingTasks")} {issues.data?.total ?? "—"}{" "}
        {text("taskCountUnit")}
      </p>
      <Failure
        error={
          projects.error ||
          issues.error ||
          counts.error ||
          notices.error ||
          people.agents.error ||
          people.squads.error ||
          snapshot.error
        }
        retry={() => {
          for (const q of [
            projects,
            issues,
            counts,
            notices,
            people.agents,
            people.members,
            people.squads,
            snapshot,
          ])
            void q.refetch();
        }}
      />
      {issues.isPending ? (
        <Empty>{text("loading")}</Empty>
      ) : issues.data?.issues.length === 0 ? (
        <Empty>{text("noMatchingTasks")}</Empty>
      ) : board ? (
        <div className="team-board">
          {options.map((s) => (
            <section key={s.value}>
              <h3>
                {s.label}{" "}
                <small>
                  {
                    issues.data?.issues.filter((i) => i.status === s.value)
                      .length
                  }
                </small>
              </h3>
              {issues.data?.issues
                .filter((i) => i.status === s.value)
                .map((i) => (
                  <button
                    className="team-task-card"
                    key={i.id}
                    onClick={() => open(i)}
                  >
                    <small>
                      {text("taskNumber")}：{i.identifier}
                    </small>
                    <IssueExecutionStatus
                      runs={
                        visibleRuns.filter((run) => run.issue_id === i.id) || []
                      }
                    />
                    <strong>{i.title}</strong>
                    <small>
                      {projects.data?.projects.find(
                        (p) => p.id === i.project_id,
                      )?.title || text("noProject")}
                    </small>
                    {updated.has(i.id) && (
                      <small className="team-update-dot">
                        {text("newUpdate")}
                      </small>
                    )}
                    <span>
                      <Avatar name={people.name(i.assignee_id)} />
                      {people.name(i.assignee_id)}
                    </span>
                  </button>
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="team-list">
          <div className="team-list-heading">
            <span>{text("task")}</span>
            <span>{text("owner")}</span>
            <span>{text("state")}</span>
            <span>{text(`sort.${sort}`)}</span>
          </div>
          {issues.data?.issues.map((i) => (
            <button
              key={i.id}
              className="team-task-row"
              onClick={() => open(i)}
            >
              <span>
                <strong>{i.title}</strong>
                {updated.has(i.id) && (
                  <small className="team-update-dot">{text("newUpdate")}</small>
                )}
                <small>
                  {text("taskNumber")}：{i.identifier} ·{" "}
                  {projects.data?.projects.find((p) => p.id === i.project_id)
                    ?.title || text("noProject")}
                </small>
              </span>
              <span className="team-person">
                <Avatar name={people.name(i.assignee_id)} />
                {people.name(i.assignee_id)}
              </span>
              <div className="team-task-status">
                <IssueExecutionStatus
                  runs={
                    visibleRuns.filter((run) => run.issue_id === i.id) || []
                  }
                />
                <span className="team-business-status">
                  {text("businessStatus")} · <Status value={i.status} />
                </span>
              </div>
              <small>
                {i[sort]
                  ? new Date(i[sort]!).toLocaleDateString()
                  : text("notSet")}
              </small>
            </button>
          ))}
        </div>
      )}
      <div className="team-pagination">
        <Action disabled={page === 0} onClick={() => setPage(page - 1)}>
          {text("previous")}
        </Action>
        <span>{page + 1}</span>
        <Action
          disabled={(page + 1) * 50 >= (issues.data?.total || 0)}
          onClick={() => setPage(page + 1)}
        >
          {text("next")}
        </Action>
      </div>
    </>
  );
}
export function NewTask({
  onClose,
  onCreated,
  source,
  draft: suppliedDraft,
  onDraftChange,
  onDiscard,
  onChangeWorkspace,
  followup,
}: {
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
  onDraftChange?: (patch: Partial<TeamDraft>) => void;
  onDiscard?: () => void;
  onChangeWorkspace?: () => void;
}) {
  const { workspace, user } = useTeam();
  const people = useTeamPeople();
  const { options } = useStatuses();
  const [localDraft, setLocalDraft] = useState(() =>
    DraftSchema.parse({ projectID: followup?.project.id }),
  );
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
    await ensureAgentAuth(draft.draftAgentID, user.id, workspace.id);
    const context = [
      draft.draftPrompt,
      source ? `${source.title}\n${source.description}` : "",
      ...excerpts,
    ]
      .filter(Boolean)
      .join("\n\n");
    const response = await teamApi.generateTaskDraft({
      request_id: crypto.randomUUID(),
      agent_id: draft.draftAgentID,
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
      due_date: draft.dueDate || undefined,
      project_id: draft.projectID || undefined,
      ...(type === "agent" || type === "member" || type === "squad"
        ? { assignee_type: type, assignee_id: agentId }
        : {}),
    });
    update({ created: { id: issue.id, title: issue.title } });
    await onCreated(issue.id, issue.title);
  });
  const busy =
    action.isPending || link.isPending || generate.isPending || uploading;
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal
      title={text(followup ? "project.followup.create" : "newTask")}
      onClose={close}
      wide
      className="team-create-modal"
    >
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
                      value={draft.draftAgentID}
                      options={[
                        { value: "", label: text("chooseAgent") },
                        ...(people.agents.data || []).map((a) => ({
                          value: a.id,
                          label: a.name,
                          disabled: !people.allowed(a),
                        })),
                      ]}
                      onChange={(draftAgentID) => update({ draftAgentID })}
                    />
                  </Field>
                  <Action
                    primary
                    disabled={
                      busy ||
                      !draft.draftAgentID ||
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
              {onDiscard && (
                <Action disabled={busy} onClick={onDiscard}>
                  {text("discardDraft")}
                </Action>
              )}
              <span className="team-spacer" />
              <Action
                primary
                disabled={
                  busy || uploadFailed ||
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
    </Modal>
  );
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
  const [confirm, setConfirm] = useState<UpdateIssueRequest | null>(null);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectRequirements, setProjectRequirements] = useState<string | null>(
    null,
  );
  const update = useTeamAction(
    async ({
      patch,
      approved = false,
    }: {
      patch: UpdateIssueRequest;
      approved?: boolean;
    }) => {
      if (!approved) {
        const preview = await teamApi.previewIssueTrigger({
          issueIds: [id],
          assigneeType: patch.assignee_type,
          assigneeId: patch.assignee_id,
          status: patch.status,
        });
        if (preview.total_count > 0) {
          setConfirm(patch);
          return;
        }
      }
      const ownerId =
        patch.assignee_id === undefined
          ? issue.data?.assignee_id
          : patch.assignee_id;
      const ownerType =
        patch.assignee_type === undefined
          ? issue.data?.assignee_type
          : patch.assignee_type;
      if (approved && ownerType === "agent" && ownerId)
        await ensureAgentAuth(ownerId, user.id, workspace.id);
      await teamApi.updateIssue(id, patch);
      setConfirm(null);
      setEdit(false);
    },
  );
  useEffect(() => {
    const topic = issue.data?.metadata.project_topic_id,
      project = issue.data?.metadata.topic_project_id;
    if (typeof topic === "string" && typeof project === "string")
      navigate(
        `/team/${workspace.slug}?view=projects&project=${project}&section=discussion&topic=${topic}`,
        { replace: true },
      );
  }, [issue.data?.metadata, navigate, workspace.slug]);
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
  return (
    <>
      <nav className="team-task-navigation">
        <button
          className="team-back"
          onClick={() =>
            navigate(
              `/team/${workspace.slug}${typeof location.state?.taskListSearch === "string" ? "?" + location.state.taskListSearch : "?view=tasks"}`,
            )
          }
        >
          <ArrowLeft size={16} />
          {text("backToTasks")}
        </button>
        {sourceRoute && (
          <Action onClick={() => navigate(sourceRoute)}>
            {text("backToPersonal")}
          </Action>
        )}
        {item.project_id && (
          <>
            <button
              className="team-text-action"
              onClick={() =>
                navigate(
                  `/team/${workspace.slug}?view=projects&project=${item.project_id}&section=${detailParams.get("section") || "tasks"}`,
                )
              }
            >
              {text("project.backProject")}
            </button>
            <button
              className="team-text-action"
              onClick={() =>
                navigate(
                  `/team/${workspace.slug}?view=projects&project=${item.project_id}&section=blueprint`,
                )
              }
            >
              {text("project.openProjectPlan")}
            </button>
          </>
        )}
      </nav>
      <div className="team-detail-heading">
        <div>
          <h1>{item.title}</h1>
          <small className="team-task-number">
            {text("taskNumber")}：{item.identifier}
          </small>
          <p className="team-task-meta">
            {text("taskProject")}：
            {sourceProject.data?.title || text("noProject")}
          </p>
          <p className="team-task-meta">
            {text("project.dueDate")}：{item.due_date || text("notSet")}
          </p>
          <IssueExecutionStatus runs={visibleRuns} />
        </div>
        <div className="team-detail-pickers">
          <Action
            variant="ghost"
            size="sm"
            disabled={subscribe.isPending}
            onClick={() => subscribe.mutate()}
          >
            {text(subscribed ? "unsubscribe" : "subscribe")}
          </Action>
          <Field label={text("businessStatus")}>
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
        </div>
      </div>
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
      <div className="team-detail-grid">
        <div className="team-main-column">
          <section className="team-brief">
            <div className="team-toolbar">
              <h3>{text("requirements")}</h3>
              <Action
                size="sm"
                onClick={() => {
                  setTitle(item.title);
                  const parts = splitProjectRequirements(
                    item.description || "",
                  );
                  setDescription(parts.description);
                  setProjectRequirements(parts.requirements);
                  setEdit(true);
                }}
              >
                {text("edit")}
              </Action>
            </div>
            <TaskRequirements issue={item} />
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
          <RunList
            issueId={id}
            people={people}
            runs={visibleRuns}
            error={runs.error}
            entries={visibleEntries}
          />
          <TimelineComposer
            runs={visibleRuns}
            issue={item}
            entries={visibleEntries}
            people={people}
          />
        </div>
        <aside className="team-artifact-column">
          <TaskArtifacts
            runs={visibleRuns}
            entries={visibleEntries}
            inputs={attachments.data?.filter((a) => !a.comment_id) || []}
          />
        </aside>
      </div>
      {confirm && (
        <Modal title={text("startConfirm")} onClose={() => setConfirm(null)}>
          <p>{text("startHint")}</p>
          <Failure error={update.error} />
          <div className="team-actions">
            <Action
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  patch: { ...confirm, suppress_run: true },
                  approved: true,
                })
              }
            >
              {text("doNotStart")}
            </Action>
            <Action
              primary
              disabled={update.isPending}
              onClick={() => update.mutate({ patch: confirm, approved: true })}
            >
              {text("confirmStart")}
            </Action>
          </div>
        </Modal>
      )}
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
                  description: joinProjectRequirements(
                    description,
                    projectRequirements,
                  ),
                  description_base: item.description || "",
                },
                approved: true,
              })
            }
          >
            {text("save")}
          </Action>
        </Modal>
      )}
    </>
  );
}
