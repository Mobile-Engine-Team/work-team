import {ProjectReceipts} from "./project-receipts";
import { planEqual } from "./blueprint-model";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { SuggestionGraphPreview } from "./suggestion-graph-preview";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Check, X } from "lucide-react";
import { ApiError } from "@multica/core/api/client";
import type { Project } from "@multica/core/types";
import type {
  BlueprintDraft,
  BlueprintGraph,
  PlanningRequest,
  ProjectStartItem,
  PlanningInput,
} from "@multica/core/types/project-blueprint";
import { teamApi, text, useTeam, useTeamAction, useTeamQuery } from "./client";
import {
  Action,
  Empty,
  Failure,
  Field,
  Modal,
  Picker,
  Textarea,
  Status,
} from "./ui";
import { useTeamPeople } from "./tasks";
import { TeamMarkdown } from "./markdown";

export function ProjectPlanning({
  project,
  draft,
  selectedNodes,
  onClose,
  onApplied,
}: {
  project: Project;
  draft: BlueprintDraft;
  selectedNodes: string[];
  onClose: () => void;
  onApplied: () => Promise<void>;
}) {
  const { workspace } = useTeam(),
    people = useTeamPeople();
  const requests = useQuery({
    queryKey: ["team", workspace.id, "blueprint", project.id, "planning"],
    queryFn: () => teamApi.listProjectPlanning(project.id),
    refetchInterval: (query) =>
      query.state.data?.requests.some(
        (r) => r.status === "queued" || r.status === "running",
      )
        ? 3000
        : false,
  });
  const [agent, setAgent] = useState("work"),
    [instructions, setInstructions] = useState(""),
    [materials, setMaterials] = useState(""),
    [requestID, setRequestID] = useState(() => crypto.randomUUID());
  const [scope, setScope] = useState(selectedNodes.length ? "selected" : "add"),
    [input, setInput] = useState<PlanningInput | null>(null);
  const options = {
    agent_id: agent,
    expected_revision: draft.revision,
    request_id: requestID,
    instructions,
    materials,
    selected_nodes: scope === "selected" ? selectedNodes : [],
    topic_id: "",
    scope,
    context_confirmed: false,
    conclusion_revision: 0,
  };
  const signature = JSON.stringify(options);
  const [previewSignature, setPreviewSignature] = useState("");
  const [focused, setFocused] = useState(""),
    [selected, setSelected] = useState<string[]>([]);
  const request =
    requests.data?.requests.find(
      (r) => r.id === focused && r.purpose !== "conclusion",
    ) || requests.data?.requests.find((r) => r.purpose !== "conclusion");
  const [adoptionPreview, setAdoptionPreview] = useState<BlueprintGraph | null>(
    null,
  );
  useEffect(
    () => setAdoptionPreview(null),
    [selected, draft.revision, request?.id],
  );
  const action = useTeamAction(async (mode: string) => {
    if (mode === "preview") {
      setInput(await teamApi.previewProjectPlanning(project.id, options));
      setPreviewSignature(signature);
      return;
    }
    if (mode === "generate") {
      const response = await teamApi.requestProjectPlanning(project.id, {
        ...options,
        input_hash: input?.input_hash,
      });
      setFocused(response.id);
      setRequestID(crypto.randomUUID());
      setSelected([]);
    }
    if (mode === "cancel" && request)
      await teamApi.cancelProjectPlanning(project.id, request.id);
    if (mode === "preview-adoption" && request) {
      setAdoptionPreview(
        await teamApi.previewProjectSuggestion(
          project.id,
          request.id,
          selected,
          draft.revision,
        ),
      );
      return;
    }
    if (mode === "apply" && request) {
      await teamApi.applyProjectSuggestion(
        project.id,
        request.id,
        selected,
        draft.revision,
      );
      setSelected([]);
      await onApplied();
    }
  });
  const pending = requests.data?.requests.some(
    (r) => r.status === "queued" || r.status === "running",
  );
  return (
    <Modal wide title={text("project.aiPlanning")} onClose={onClose}>
      <div className="project-ai-layout">
        <section>
          <Field label={text("project.planningAssistant")}>
            <Picker
              label={text("project.chooseAssistant")}
              value={agent}
              onChange={setAgent}
              options={[{value:"work",label:"Work"},...(people.agents.data||[]).filter(a=>a.system_key!=="mobilework" && people.allowed(a)).map(a=>({value:a.id,label:a.name}))]}
            />
          </Field>
          <p className="project-helper">{text("project.planningSupport")}</p>
          <Field label={text("project.planningInstructions")}>
            <Textarea
              rows={4}
              placeholder={text("project.adjustmentExample")}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <Field label={text("project.selectedMaterials")}>
            <Textarea
              rows={3}
              value={materials}
              maxLength={50000}
              onChange={(e) => setMaterials(e.target.value)}
              placeholder={text("project.materialsHint")}
            />
          </Field>
          <Field label={text("project.allowedScope")}>
            <Picker
              label={text("project.allowedScope")}
              value={scope}
              onChange={setScope}
              options={[
                { value: "add", label: text("project.scopeAdd") },
                ...(selectedNodes.length
                  ? [
                      {
                        value: "selected",
                        label: text("project.scopeSelected"),
                      },
                    ]
                  : []),
                { value: "all", label: text("project.entireDraft") },
              ]}
            />
          </Field>
          <Action
            disabled={action.isPending}
            onClick={() => action.mutate("preview")}
          >
            {text("project.previewInput")}
          </Action>
          {input && (
            <section className="project-input-preview">
              <h4>{text("project.goal")}</h4>
              <TeamMarkdown content={input.goal} />
              <h4>{text("project.allowedScope")}</h4>
              <p>
                {text(
                  input.scope === "add"
                    ? "project.scopeAdd"
                    : input.scope === "selected"
                      ? "project.scopeSelected"
                      : "project.entireDraft",
                )}
              </p>
              <p>{input.instructions}</p>
              {input.graph.nodes.map((n) => (
                <div key={n.id}>
                  <strong>{n.title}</strong>
                  <p>{n.requirements}</p>
                  {n.baseline && (
                    <p>
                      {text("project.planSnapshot")}{" "}
                      <Status value={n.baseline.status} />
                    </p>
                  )}
                  {input.live_tasks[n.id] && (
                    <>
                      <p>
                        {text("project.latestExecution")}{" "}
                        <Status value={input.live_tasks[n.id].status} />
                      </p>
                      <TeamMarkdown
                        content={input.live_tasks[n.id].description}
                      />
                    </>
                  )}
                </div>
              ))}
              {input.materials && <h4>{text("project.selectedMaterials")}</h4>}
              {input.messages.map((m, i) => (
                <TeamMarkdown key={i} content={m} />
              ))}
              <TeamMarkdown content={input.materials} />
              {input.related_tasks.map((i, index) => (
                <div key={index}>
                  <strong>{i.title}</strong>
                  <Status value={i.status} />
                  <TeamMarkdown content={i.description} />
                </div>
              ))}
            </section>
          )}
          <p className="project-helper">{text("project.planningCost")}</p>
          <Action
            primary
            disabled={
              !agent ||
              action.isPending ||
              pending ||
              !input ||
              previewSignature !== signature
            }
            onClick={() => action.mutate("generate")}
          >
            <Sparkles size={16} />
            {text("project.generate")}
          </Action>
        </section>
        <section className="project-ai-results">
          <div className="project-section-heading">
            <h3>{text("project.suggestions")}</h3>
            {request && (
              <span>{text(`project.planning.${request.status}`)}</span>
            )}
          </div>
          <Failure
            error={action.error || requests.error}
            message={
              action.error instanceof ApiError
                ? action.error.message
                : undefined
            }
          />
          {request?.error && (
            <div className="project-planning-error" role="alert">
              {request.error}
            </div>
          )}
          {request &&
            (request.status === "running" || request.status === "queued") && (
              <>
                <p>{text("project.planningPending")}</p>
                <Action onClick={() => action.mutate("cancel")}>
                  <X size={15} />
                  {text("cancel")}
                </Action>
              </>
            )}
          {request?.result ? (
            <>
              <p className="project-helper">
                {request.base_revision !== draft.revision
                  ? text("project.staleSuggestion")
                  : text("project.suggestionHint")}
              </p>
              <div className="project-suggestion-list">
                {[
                  { key: "newWork", kinds: ["add"] },
                  { key: "changedWork", kinds: ["update", "remove"] },
                  {
                    key: "dependencyChanges",
                    kinds: ["add_edge", "remove_edge"],
                  },
                ].map((group) => (
                  <section key={group.key}>
                    <h4>{text(`project.${group.key}`)}</h4>
                    {request
                      .result!.changes.filter((c) =>
                        group.kinds.includes(c.kind),
                      )
                      .map((c) => {
                        const applied = request.applied?.includes(c.id);
                        return (
                          <label key={c.id} className="project-suggestion">
                            <input
                              type="checkbox"
                              disabled={applied}
                              checked={!!applied || selected.includes(c.id)}
                              onChange={(e) =>
                                setSelected(
                                  e.target.checked
                                    ? [...selected, c.id]
                                    : selected.filter((id) => id !== c.id),
                                )
                              }
                            />
                            <div>
                              <small>
                                {text(`project.suggestion.${c.kind}`)}
                                {applied && ` · ${text("project.adopted")}`}
                              </small>
                              <strong>
                                {c.node?.title ||
                                  draft.graph.nodes.find(
                                    (n) => n.id === c.target,
                                  )?.title ||
                                  text("project.dependency")}
                              </strong>
                              {c.kind === "update" && (
                                <del>
                                  {
                                    draft.graph.nodes.find(
                                      (n) => n.id === c.target,
                                    )?.requirements
                                  }
                                </del>
                              )}
                              {c.node?.requirements && (
                                <p>{c.node.requirements}</p>
                              )}
                              {c.edge && (
                                <p>
                                  {draft.graph.nodes.find(
                                    (n) => n.id === c.edge?.from,
                                  )?.title || c.edge.from}{" "}
                                  →{" "}
                                  {draft.graph.nodes.find(
                                    (n) => n.id === c.edge?.to,
                                  )?.title || c.edge.to}
                                  <br />
                                  {c.edge.handoff}
                                </p>
                              )}
                              <p className="project-helper">{c.reason}</p>
                            </div>
                          </label>
                        );
                      })}
                  </section>
                ))}
              </div>
              {request.result.questions?.length ? (
                <div>
                  <h4>{text("project.questions")}</h4>
                  <ul>
                    {request.result.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Action
                disabled={!selected.length || action.isPending}
                onClick={() => action.mutate("preview-adoption")}
              >
                {text("project.previewSelectedChanges")}
              </Action>
              {adoptionPreview && (
                <SuggestionGraphPreview
                  graph={adoptionPreview}
                  changes={request.result.changes.filter((c) =>
                    selected.includes(c.id),
                  )}
                />
              )}
              <Action
                primary
                disabled={
                  !selected.length || action.isPending || !adoptionPreview
                }
                onClick={() => action.mutate("apply")}
              >
                <Check size={16} />
                {text("project.adoptSelected")} ({selected.length})
              </Action>
            </>
          ) : !pending && !request?.error ? (
            <Empty>{text("project.noSuggestions")}</Empty>
          ) : null}
          {!!requests.data?.requests.length && (
            <details>
              <summary>{text("project.planningHistory")}</summary>
              {requests.data.requests
                .filter((r) => r.purpose !== "conclusion")
                .map((r) => (
                  <button
                    className="project-request-row"
                    key={r.id}
                    onClick={() => {
                      setFocused(r.id);
                      setSelected([]);
                    }}
                  >
                    {people.name(r.agent_id)} ·{" "}
                    {text(`project.planning.${r.status}`)} ·{" "}
                    {new Date(r.created_at).toLocaleTimeString()}
                  </button>
                ))}
            </details>
          )}
        </section>
      </div>
    </Modal>
  );
}
export function ProjectStart({
  project,
  onClose,
  predecessorId,
  localUnpublished = false,
  onViewChanges,
}: {
  project: Pick<Project, "id">;
  onClose: () => void;
  predecessorId?: string;
  localUnpublished?: boolean;
  onViewChanges?: () => void;
}) {
  const people = useTeamPeople();
  const state = useTeamQuery(["blueprint", project.id, "start"], () =>
    teamApi.getProjectStartState(project.id),
  );
  const navigate = useNavigate();
  const { workspace } = useTeam();
  const draft = useTeamQuery(["blueprint", project.id, "draft"], () =>
    teamApi.getBlueprintDraft(project.id),
  );
  const versions = useTeamQuery(["blueprint", project.id, "versions"], () =>
    teamApi.listBlueprintVersions(project.id),
  );
  const current = versions.data?.versions.find(
    (v) => v.number === state.data?.version,
  );
  const unpublished =
    localUnpublished ||
    (draft.data?.draft?.status === "active" &&
      current &&
      !planEqual(draft.data.draft.graph, current.graph));
  const viewChanges = () => {
    if (onViewChanges) onViewChanges();
    else {
      onClose();
      navigate(
        `/team/${workspace.slug}?view=projects&project=${project.id}&section=blueprint`,
      );
    }
  };
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<ProjectStartItem[]>([]);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const busy = useRef(false);
  const items = (state.data?.items || []).filter(
    (i) => !predecessorId || i.predecessor_ids.includes(predecessorId),
  );
  const succeeded = new Set(
    results
      .filter((i) => i.status === "notified" || i.status === "queued")
      .map((i) => i.issue_id),
  );
  const ready = items.filter((i) => !i.reason && !succeeded.has(i.issue_id));
  const chosen = ready.filter((i) => selected.includes(i.issue_id));
  const action = useTeamAction(async () => {
    if (!state.data || busy.current || !chosen.length) return;
    busy.current = true;
    try {
      const response = await teamApi.startProjectTasks(
        project.id,
        state.data.version,
        key,
        chosen,
      );
      setResults((previous) => [
        ...previous.filter(
          (i) => !response.items.some((next) => next.issue_id === i.issue_id),
        ),
        ...response.items,
      ]);
      setSelected(
        response.items
          .filter((i) => i.status === "failed")
          .map((i) => i.issue_id),
      );
      setKey(crypto.randomUUID());
      await state.refetch();
    } finally {
      busy.current = false;
    }
  });
  const actionLabel = (i: ProjectStartItem) =>
    `${text(i.assignee_type === "member" ? "project.notifyPerson" : "project.requestAgent")} · ${people.name(i.assignee_id || null)}`;
  const title = text(predecessorId ? "project.viewHandoff" : "project.startTasks");
  if (!state.data || state.data.version === 0) {
    return (
      <Modal wide title={title} className="mw-handoff-dialog" onClose={onClose}>
        <div className="mw-handoff-body">
          {state.error
            ? <Failure error={state.error} retry={() => void state.refetch()} />
            : <p className="project-plan-version" role="status">
                {text(state.data ? "project.noPublishedPlan" : "loading")}
              </p>}
          <div className="project-actions">
            <Action onClick={onClose}>{text("close")}</Action>
            {state.data?.version === 0 && !state.error &&
              <Action primary onClick={viewChanges}>前往施工蓝图</Action>}
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      wide
      title={title}
      className="mw-handoff-dialog"
      onClose={onClose}
    >
      <div className="mw-handoff-body">
      <p className="project-plan-version">
        <strong>
          {text("project.startVersion")} V{state.data.version}
        </strong>
      </p>
      {unpublished && (
        <div className="project-notice">
          <strong>{text("project.draftExcluded")}</strong>
          <Action onClick={viewChanges}>
            {text("project.viewDraftChanges")}
          </Action>
        </div>
      )}
      <p>{text("project.startTasksHint")}</p>
      <p className="mw-handoff-hint">确认后向成员投递站内通知，或向智能体提交执行请求。回执显示送达、入队或失败的结果。</p>
      <Failure
        error={state.error || action.error}
        retry={() => void state.refetch()}
      />
      <div className="project-start-list">
        {items
          .filter((i) => !succeeded.has(i.issue_id))
          .map((i) => (
            <label
              key={i.issue_id}
              className={
                i.reason ? "project-start-blocked" : "project-start-ready"
              }
            >
              <input
                type="checkbox" aria-label={i.title}
                disabled={!!i.reason || action.isPending}
                checked={selected.includes(i.issue_id) && !i.reason}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...selected, i.issue_id]
                      : selected.filter((id) => id !== i.issue_id),
                  )
                }
              />
              <div>
                <strong>{i.title}</strong>
                <small>
                  {text("project.assignee")}：
                  {people.name(i.assignee_id || null)}
                </small>
                <p className="project-start-reason">
                  {i.reason ? (
                    <CircleAlert size={18} />
                  ) : (
                    <CheckCircle2 size={18} />
                  )}
                  <strong>
                    {i.reason ||
                      text(
                        i.assignee_type === "member"
                          ? "project.canNotify"
                          : "project.canRequest",
                      )}
                  </strong>
                </p>
              </div>
            </label>
          ))}
      </div>
      <ProjectReceipts project={project.id}/>
      {results.length > 0 && (
        <section aria-live="polite">
          <h3>{text("project.handoffResults")}</h3>
          {results.map((i) => (
            <div className="project-start-result" key={i.issue_id}>
              <strong>{i.title}</strong>
              <span>{text(`project.start.${i.status}`)}</span>
              {i.reason && <p>{i.reason}</p>}
            </div>
          ))}
        </section>
      )}
      {!state.isPending && !state.error && (
        <p role="status">
          {ready.length
            ? `${text("project.remainingReady")}：${ready.length}`
            : text("project.noReadyHandoff")}
        </p>
      )}
      {chosen.length > 0 && (
        <div className="project-handoff-confirm">
          <strong>{text("project.confirmRecipients")}</strong>
          {chosen.map((i) => (
            <p key={i.issue_id}>
              {actionLabel(i)} · {i.title}
            </p>
          ))}
        </div>
      )}
      <div className="project-actions">
        <Action onClick={onClose} disabled={action.isPending}>
          {text(results.length ? "project.finishHandoff" : "close")}
        </Action>
        {ready.length > 0 && (
          <Action
            primary
            disabled={!chosen.length || action.isPending}
            onClick={() => action.mutate()}
          >
            {text(action.isPending ? "sending" : "project.confirmStart")} (
            {chosen.length})
          </Action>
        )}
      </div>
      </div>
    </Modal>
  );
}
