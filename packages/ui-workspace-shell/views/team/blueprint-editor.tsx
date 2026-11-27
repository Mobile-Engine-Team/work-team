import {
  blueprintDraftSchema,
  blueprintNodeSchema,
  blueprintEdgeSchema,
  blueprintGraphSchema,
} from "@multica/core/types/project-blueprint";
import {
  displayProjectRequirements,
  importProjectRequirements,
} from "./project-requirements";
import { allProjectIssues } from "./project-issues";
import { ProjectChangeDetails } from "./project-change-details";
import { ProjectPlanning, ProjectStart } from "./project-planning";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Play, Plus, Undo2, Redo2, Maximize, LayoutGrid, Link2, History, Trash2, GitBranch, Save, Check, ZoomIn, ZoomOut } from "lucide-react";
import { ApiError } from "@multica/core/api";
import type {
  BlueprintDraft,
  BlueprintGraph,
  BlueprintNode,
  BlueprintPreview,
  BlueprintVersion,
  PublishBlueprintRequest,
} from "@multica/core/types/project-blueprint";
import type { Issue, Project } from "@multica/core/types";
import { teamApi, text, useTeam, useTeamAction, useTeamQuery } from "./client";
import {
  Action,
  Empty,
  Failure,
  PlanFailure,
  Field,
  Input,
  Modal,
  Picker,
  Status,
  Textarea,
} from "./ui";
import { useTeamPeople } from "./tasks";
import {
  isNewerDraftRevision,
  describeChanges,
  emptyGraph,
  graphEqual,
  planEqual,
  layoutGraph,
  mergeGraphs,
  newNode,
  validEdge,
  type MergeConflict,
} from "./blueprint-model";

type Point = { x: number; y: number };
type NodeDrag = { kind: "node"; id: string; position: Point; scale: number };
type CanvasGesture = { pointerId: number; start: Point } & (
  | NodeDrag
  | { kind: "pan"; pan: Point }
  | { kind: "box" }
);

function draggedPosition(drag: CanvasGesture & NodeDrag, x: number, y: number): Point {
  return {
    x: Math.max(0, drag.position.x + (x - drag.start.x) / drag.scale),
    y: Math.max(0, drag.position.y + (y - drag.start.y) / drag.scale),
  };
}

type ConflictState = {
  base: BlueprintGraph;
  local: BlueprintGraph;
  remote: BlueprintDraft;
  conflicts: MergeConflict[];
};
export function BlueprintEditor({
  project,
  issues,
  canPublish,
  onOpen,
}: {
  project: Project;
  issues: Issue[];
  canPublish: boolean;
  onOpen: (id: string) => void;
}) {
  const { user } = useTeam();
  const people = useTeamPeople();
  const draftQuery = useTeamQuery(["blueprint", project.id, "draft"], () =>
    teamApi.getBlueprintDraft(project.id),
  );
  const versionsQuery = useTeamQuery(
    ["blueprint", project.id, "versions"],
    () => teamApi.listBlueprintVersions(project.id),
  );
  const versions = versionsQuery.data?.versions || [],
    current = versions[0];
  const [draft, setDraft] = useState<BlueprintDraft | null>(null),
    [graph, setGraph] = useState<BlueprintGraph>(emptyGraph);
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const baseRef = useRef<BlueprintDraft | null>(null),
    savingRef = useRef(false),
    recoveryRead = useRef(false);
  const [saving, setSaving] = useState(false),
    [error, setError] = useState<unknown>(null),
    [conflict, setConflict] = useState<ConflictState | null>(null);
  const [choices, setChoices] = useState<Record<string, "local" | "remote">>(
    {},
  );
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [boxSelect, setBoxSelect] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{
    x: number;
    y: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [selected, setSelected] = useState(""),
    [edgeID, setEdgeID] = useState(""),
    [connectFrom, setConnectFrom] = useState("");
  const [adding, setAdding] = useState(false),
    [search, setSearch] = useState("");
  const [history, setHistory] = useState<
      { before: BlueprintGraph; after: BlueprintGraph }[]
    >([]),
    [redo, setRedo] = useState<
      { before: BlueprintGraph; after: BlueprintGraph }[]
    >([]);
  const [preview, setPreview] = useState<BlueprintPreview | null>(null),
    [publishBody, setPublishBody] = useState<PublishBlueprintRequest | null>(
      null,
    ),
    [reason, setReason] = useState("");
  const [remotePublished, setRemotePublished] = useState<BlueprintDraft | null>(
    null,
  );
  const [planning, setPlanning] = useState(false),
    [starting, setStarting] = useState(false);
  const [showHistory, setShowHistory] = useState(false),
    [viewVersion, setViewVersion] = useState<BlueprintVersion | null>(null);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 20, y: 20 });
  const canvas = useRef<HTMLDivElement>(null);
  const gesture = useRef<CanvasGesture | null>(null);
  const [nodePreview, setNodePreview] = useState<{id: string; position: Point} | null>(null);
  function cancelGesture(pointerId: number) {
    const active = gesture.current;
    if (!active || active.pointerId !== pointerId) return;
    gesture.current = null;
    if (active.kind === "pan") setPan(active.pan);
    setNodePreview(null);
    setSelectionBox(null);
  }
  const canEditDraft = draft?.status === "active" && !!people.role;
  const editable = canEditDraft && !viewVersion;
  const displayedAuthor = viewVersion?.published_by ?? (canEditDraft ? draft.updated_by : current?.published_by);
  const unpublished =
    !!current && draft?.status === "active" && !planEqual(graph, current.graph);
  const dirty = !!draft && !graphEqual(graph, baseRef.current?.graph);
  const visiblePlan =
    viewVersion?.graph ||
    (draft?.status === "active" ? graph : current?.graph) ||
    emptyGraph();
  // Pointer previews never enter draft recovery, undo history or autosave.
  const displayed = editable && nodePreview ? {
    ...visiblePlan,
    nodes: visiblePlan.nodes.map(n => n.id === nodePreview.id ? {...n, position: nodePreview.position} : n),
  } : visiblePlan;
  const node = displayed.nodes.find((n) => n.id === selected),
    edge = displayed.edges.find((e) => e.id === edgeID);
  const synced = (d: BlueprintDraft) => {
    baseRef.current = d;
    setDraft(d);
    graphRef.current = d.graph;
    setGraph(d.graph);
    setRemotePublished(null);
  };
  useEffect(() => {
    const remote = draftQuery.data?.draft;
    if (!remote || savingRef.current || conflict) return;
    if (!recoveryRead.current) {
      recoveryRead.current = true;
      const key = `mw.blueprint.recovery:${user.id}:${project.id}`;
      try {
        const raw = sessionStorage.getItem(key);
        if (raw && remote.status === "active") {
          const stored = JSON.parse(raw);
          const base = blueprintDraftSchema.parse(stored.base);
          const local = blueprintGraphSchema.parse(stored.graph);
          const merged = mergeGraphs(base.graph, local, remote.graph);
          baseRef.current = remote;
          setDraft(remote);
          setGraph(merged.graph);
          if (merged.conflicts.length)
            setConflict({
              base: base.graph,
              local,
              remote,
              conflicts: merged.conflicts,
            });
          return;
        }
      } catch {
        setError(new Error(text("project.recoveryInvalid")));
      }
    }
    const base = baseRef.current;
    // Ignore responses fetched before our last acknowledged save or new draft.
    if (!isNewerDraftRevision(base, remote)) return;
    if (
      base &&
      remote.status !== "active" &&
      !graphEqual(graphRef.current, base.graph)
    ) {
      setRemotePublished(remote);
      return;
    }
    if (!base || graphEqual(graphRef.current, base.graph)) {
      if (!base || remote.revision !== base.revision) synced(remote);
      return;
    }
    if (remote.revision > base.revision) {
      const merged = mergeGraphs(base.graph, graphRef.current, remote.graph);
      if (merged.conflicts.length)
        setConflict({
          base: base.graph,
          local: graphRef.current,
          remote,
          conflicts: merged.conflicts,
        });
      else {
        baseRef.current = remote;
        setDraft(remote);
        setGraph(merged.graph);
      }
    }
  }, [draftQuery.data, conflict]);
  async function save(refreshBaseline = false): Promise<BlueprintDraft | null> {
    const base = baseRef.current;
    if (
      !base ||
      savingRef.current ||
      conflict ||
      (!refreshBaseline && graphEqual(graphRef.current, base.graph))
    )
      return base;
    const submitted = graphRef.current;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await teamApi.saveBlueprintDraft(
        project.id,
        base.revision,
        submitted,
        refreshBaseline,
      );
      const latest = graphRef.current;
      baseRef.current = saved;
      setDraft(saved);
      const merged = mergeGraphs(submitted, latest, saved.graph);
      if (merged.conflicts.length) {
        setConflict({ base: submitted, local: latest, remote: saved, conflicts: merged.conflicts });
        return null;
      }
      if (refreshBaseline && !graphEqual(latest, merged.graph)) {
        setHistory(h => [...h, { before: latest, after: merged.graph }]);
        setRedo([]);
      }
      graphRef.current = merged.graph;
      setGraph(merged.graph);
      return saved;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        let remote: BlueprintDraft | null | undefined;
        try {
          remote = (await teamApi.getBlueprintDraft(project.id)).draft;
        } catch (recoveryError) {
          setError(recoveryError);
          return null;
        }
        if (!remote) setError(e);
        if (remote) {
          if (remote.revision === base.revision && remote.status === "active") {
            setError(e);
            return null;
          }
          if (remote.status !== "active") {
            setRemotePublished(remote);
            return null;
          }
          const merged = mergeGraphs(
            base.graph,
            graphRef.current,
            remote.graph,
          );
          if (merged.conflicts.length)
            setConflict({
              base: base.graph,
              local: graphRef.current,
              remote,
              conflicts: merged.conflicts,
            });
          else {
            baseRef.current = remote;
            setDraft(remote);
            setGraph(merged.graph);
          }
        }
      } else setError(e);
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!dirty || !canEditDraft || conflict || remotePublished || error || saving)
      return;
    const timer = setTimeout(() => void save(), 700);
    return () => clearTimeout(timer);
  }, [graph, draft, canEditDraft, conflict, remotePublished, error, saving]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (
        baseRef.current &&
        !graphEqual(graphRef.current, baseRef.current.graph)
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  // Recovery copies contain only this explicitly opened project and are never shared server facts.
  useEffect(() => {
    const key = `mw.blueprint.recovery:${user.id}:${project.id}`;
    if (conflict)
      sessionStorage.setItem(
        key,
        JSON.stringify({
          base: { ...conflict.remote, graph: conflict.base },
          graph: conflict.local,
        }),
      );
    else if (dirty)
      sessionStorage.setItem(
        key,
        JSON.stringify({ base: baseRef.current, graph }),
      );
    else if (draft) sessionStorage.removeItem(key);
  }, [graph, dirty, draft, conflict, user.id, project.id]);
  function conflictLabel(path: string) {
    if (!conflict) return "";
    const [kind, id, field] = path.split(".");
    const graphs = [conflict.local, conflict.remote.graph, conflict.base];
    const fields: Record<string, string> = {
      title: "title",
      requirements: "requirements",
      assignee_id: "assignee",
      assignee_type: "assignee",
      due_date: "dueDate",
    };
    if (kind === "nodes") {
      const n = graphs.flatMap((g) => g.nodes).find((n) => n.id === id);
      return `${n?.title || text("project.title")}${fields[field] ? ` · ${text(`project.${fields[field]}`)}` : ""}`;
    }
    const edge = graphs.flatMap((g) => g.edges).find((e) => e.id === id);
    const label = (nodeID: string) =>
      graphs.flatMap((g) => g.nodes).find((n) => n.id === nodeID)?.title || "?";
    return edge
      ? `${label(edge.from)} → ${label(edge.to)} · ${text("project.dependency")}`
      : text("project.dependency");
  }
  function conflictValue(path: string, value: unknown): string {
    if (value === undefined) return text("project.removed");
    if (typeof value === "string") {
      if (path.endsWith(".assignee_id")) return people.name(value || null);
      if (path.endsWith(".assignee_type")) {
        const kinds: Record<string, string> = {
          member: "mentionMember",
          agent: "mentionAgent",
          squad: "mentionSquad",
        };
        return kinds[value] ? text(kinds[value]) : text("unassigned");
      }
      return value || "—";
    }
    const node = blueprintNodeSchema.safeParse(value);
    if (node.success)
      return [
        node.data.title,
        node.data.requirements,
        people.name(node.data.assignee_id || null),
        node.data.due_date,
      ]
        .filter(Boolean)
        .join("\n");
    const edge = blueprintEdgeSchema.safeParse(value);
    if (edge.success) {
      const nodes = [
        ...(conflict?.local.nodes || []),
        ...(conflict?.remote.graph.nodes || []),
      ];
      const title = (id: string) =>
        nodes.find((n) => n.id === id)?.title || "?";
      return `${title(edge.data.from)} → ${title(edge.data.to)}\n${edge.data.handoff}`;
    }
    return "—";
  }
  function change(next: BlueprintGraph) {
    if (!editable) return;
    const before = graphRef.current;
    graphRef.current = next;
    setHistory((h) => [...h.slice(-49), { before, after: next }]);
    setRedo([]);
    setGraph(next);
    setError(null);
  }
  function selectNode(id: string) {
    setMultiSelected([]);
    setEdgeID("");
    setSelected(id);
  }
  function selectNewNode(n: BlueprintNode) {
    selectNode(n.id);
    if (!canvas.current) return;
    const left = pan.x + n.position.x * zoom;
    const top = pan.y + n.position.y * zoom;
    if (left < 0 || top < 0 || left + 260 * zoom > canvas.current.clientWidth || top + 140 * zoom > canvas.current.clientHeight) {
      setPan({x:40 - n.position.x * zoom, y:40 - n.position.y * zoom});
    }
  }
  function selectEdge(id: string) {
    setMultiSelected([]);
    setSelected("");
    setEdgeID(id);
  }
  function patchNode(patch: Partial<BlueprintNode>) {
    change({
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === selected ? { ...n, ...patch } : n,
      ),
    });
  }
  function undoChange(back: boolean) {
    const list = back ? history : redo,
      step = list.at(-1);
    if (!step) return;
    const merged = mergeGraphs(
      back ? step.after : step.before,
      back ? step.before : step.after,
      graph,
    );
    setGraph(merged.graph);
    if (back) {
      setHistory((h) => h.slice(0, -1));
      setRedo((h) => [...h, step]);
    } else {
      setRedo((h) => h.slice(0, -1));
      setHistory((h) => [...h, step]);
    }
    if (merged.conflicts.length)
      setError(new Error(text("project.undoConflict")));
  }
  function addEdge(from: string, to: string) {
    if (!editable) return;
    if (!validEdge(graph, from, to)) {
      setError(new Error(text("project.invalidEdge")));
      return;
    }
    change({
      ...graph,
      edges: [
        ...graph.edges,
        { id: crypto.randomUUID(), from, to, handoff: "" },
      ],
    });
    setConnectFrom("");
  }
  function fit() {
    const width = canvas.current?.clientWidth || 800,
      height = canvas.current?.clientHeight || 600;
    const maxX = Math.max(
        500,
        ...displayed.nodes.map((n) => n.position.x + 280),
      ),
      maxY = Math.max(300, ...displayed.nodes.map((n) => n.position.y + 150));
    setZoom(
      Math.min(
        1.2,
        Math.max(0.15, Math.min((width - 60) / maxX, (height - 60) / maxY)),
      ),
    );
    setPan({ x: 20, y: 20 });
  }
  const action = useTeamAction(async (mode: string) => {
    if (mode === "rebase") {
      const base = baseRef.current;
      if (!base) return;
      const response = await teamApi.getBlueprintDraft(project.id, true);
      const remote = response.draft;
      if (!remote) return;
      const merged = mergeGraphs(base.graph, graphRef.current, remote.graph);
      if (merged.conflicts.length)
        setConflict({
          base: base.graph,
          local: graphRef.current,
          remote,
          conflicts: merged.conflicts,
        });
      else {
        baseRef.current = remote;
        setDraft(remote);
        setGraph(merged.graph);
      }
      setRemotePublished(null);
    }
    if (mode === "planning") {
      const saved = await save();
      if (saved && graphEqual(graphRef.current, saved.graph)) setPlanning(true);
    }
    if (mode === "refresh") {
      if (!window.confirm(text("project.refreshConfirm"))) return;
      await save(true);
    }
    if (mode === "edit") {
      const response = await teamApi.getBlueprintDraft(project.id, true);
      if (response.draft) synced(response.draft);
    }
    if (mode === "preview") {
      const saved = await save();
      if (!saved || !graphEqual(graphRef.current, saved.graph)) return;
      const body = {
        expected_revision: saved.revision,
        base_version: saved.base_version,
        request_id: crypto.randomUUID(),
        reason,
      };
      setPublishBody(body);
      setPreview(await teamApi.previewBlueprint(project.id, body));
    }
    if (mode === "publish" && publishBody) {
      const v = await teamApi.publishBlueprint(project.id, {
        ...publishBody,
        reason,
      });
      setPreview(null);
      baseRef.current = null;
      setDraft(null);
      setGraph(v.graph);
      setHistory([]);
      setRedo([]);
    }
  });
  const existing = useTeamQuery(
    ["issues", "blueprint-candidates", project.id],
    () => allProjectIssues(project.id, {includeUnassigned:true}),
    adding,
  );
  const includedIds = new Set(graph.nodes.map(n => n.issue_id));
  const term = search.trim().toLowerCase();
  const candidates = (existing.data || []).filter(i => !includedIds.has(i.id) &&
    `${i.title} ${i.identifier}`.toLowerCase().includes(term));
  const include = useTeamAction(async (i: Issue) => {
    const topics = await teamApi.listIssueProjectTopics(i.id);
    const currentGraph = graphRef.current;
    const alreadyIncluded = currentGraph.nodes.find(n => n.issue_id === i.id);
    if (alreadyIncluded) {
      selectNewNode(alreadyIncluded);
      return;
    }
    const adopted = topics.topics.flatMap(t => t.adopted_versions.map(v => v.content));
    const contract = {
      title:i.title, requirements:importProjectRequirements(i.description || "", adopted),
      assignee_type:i.assignee_type || "", assignee_id:i.assignee_id || "",
      due_date:i.due_date?.slice(0,10) || "",
    };
    const n = {
      ...newNode(i.title), ...contract, issue_id:i.id,
      baseline:{...contract, description:i.description || "", status:i.status, project_id:i.project_id || ""},
      position:{
        x:80 + (currentGraph.nodes.length % 4) * 300,
        y:80 + Math.floor(currentGraph.nodes.length / 4) * 170,
      },
    };
    change({...currentGraph, nodes:[...currentGraph.nodes, n]});
    selectNewNode(n);
  });
  return (
    <section className="mw-blueprint">
      <div className="project-plan-heading">
        <div>
          <span className="project-eyebrow">{text("project.blueprint")}</span>
          <h2>
            {viewVersion
              ? `V${viewVersion.number}`
              : !current
                ? text("project.planDraft")
                : unpublished
                  ? `${text("project.unpublished")} · ${text("project.basedOn")} V${current.number}`
                  : `${text("project.currentPlan")} V${current.number} · ${text("project.effective")}`}
          </h2>
          <span className="project-save-state" role="status">
            {saving
              ? text("project.saving")
              : error
                ? text("project.saveFailed")
                : conflict
                  ? text("project.conflict")
                  : dirty
                    ? text("project.unsaved")
                    : text("project.saved")}
            {displayedAuthor && ` · ${people.name(displayedAuthor)}`}
          </span>
        </div>
        <div className="project-actions">
          {!viewVersion && (
            <Action onClick={() => setStarting(true)}>
              <Play size={15} />
              {text("project.startTasks")}
            </Action>
          )}
          {viewVersion ? (
            <Action onClick={() => setViewVersion(null)}>
              {text("project.backCurrent")}
            </Action>
          ) : editable ? (
            <>
              {!dirty && !saving && !error ? (
                <span className="project-save-confirm" role="status">
                  <Check size={15} />
                  {text("project.saved")}
                </span>
              ) : (
                <Action
                  disabled={saving || !!conflict}
                  onClick={() => void save()}
                >
                  <Save size={15} />
                  {text(
                    saving
                      ? "project.saving"
                      : error
                        ? "retry"
                        : "project.save",
                  )}
                </Action>
              )}
              {canPublish && (
                <Action
                  primary
                  disabled={saving || !!conflict || action.isPending}
                  onClick={() => action.mutate("preview")}
                >
                  {text("project.reviewPublish")}
                </Action>
              )}
            </>
          ) : !!people.role && !project.workflow_id ? (
            <Action primary onClick={() => action.mutate("edit")}>
              {text("project.editDraft")}
            </Action>
          ) : null}
        </div>
      </div>
      <PlanFailure
        error={error || action.error || draftQuery.error || versionsQuery.error}
      />
      {project.workflow_id && <Empty>{text("project.customWorkflow")}</Empty>}
      {remotePublished && (
        <div className="project-notice">
          {text(
            remotePublished.updated_by === user.id
              ? "project.selfPublished"
              : "project.remotePublished",
          )}
          <Action onClick={() => action.mutate("rebase")}>
            {text("project.rebaseLocal")}
          </Action>
        </div>
      )}
      <div className="project-canvas-tools">
        {editable && (
          <>
            <Action
              onClick={() => {
                const n = newNode(text("project.untitled"));
                n.position = {
                  x: 80 + (graph.nodes.length % 4) * 300,
                  y: 80 + Math.floor(graph.nodes.length / 4) * 170,
                };
                change({ ...graph, nodes: [...graph.nodes, n] });
                selectNewNode(n);
              }}
            >
              <Plus size={15} />
              {text("project.addNode")}
            </Action>
            <Action onClick={() => setAdding(true)}>
              {text("project.includeExisting")}
            </Action>
            <Action
              aria-label={text("project.undo")}
              disabled={!history.length}
              onClick={() => undoChange(true)}
            >
              <Undo2 size={16} />
            </Action>
            <Action
              aria-label={text("project.redo")}
              disabled={!redo.length}
              onClick={() => undoChange(false)}
            >
              <Redo2 size={16} />
            </Action>
            <Action onClick={() => change(layoutGraph(graph))}>
              <LayoutGrid size={15} />
              {text("project.layout")}
            </Action>
          </>
        )}
        {editable && (
          <Action
            disabled={saving || !!conflict}
            onClick={() => action.mutate("refresh")}
          >
            {text("project.refreshContracts")}
          </Action>
        )}
        {editable && (
          <Action
            onClick={() => action.mutate("planning")}
            disabled={saving || !!conflict}
          >
            <Sparkles size={15} />
            {text("project.aiAssist")}
          </Action>
        )}
        <Action
          aria-pressed={boxSelect}
          primary={boxSelect}
          onClick={() => setBoxSelect((v) => !v)}
        >
          <Maximize size={15} />
          {text("project.boxSelect")}
        </Action>
        <Picker
          label={text("project.findNode")}
          value={selected}
          options={displayed.nodes.map((n) => ({
            value: n.id,
            label: n.title,
          }))}
          onChange={(id) => {
            const n = displayed.nodes.find((n) => n.id === id);
            if (!n) return;
            selectNode(id);
            setZoom(0.9);
            setPan({ x: 40 - n.position.x * 0.9, y: 40 - n.position.y * 0.9 });
          }}
        />
        <span className="team-spacer" />
        <Action
          aria-label={text("project.zoomOut")}
          onClick={() => setZoom((z) => Math.max(0.15, z - 0.15))}
        >
          <ZoomOut size={16} />
        </Action>
        <span>{Math.round(zoom * 100)}%</span>
        <Action
          aria-label={text("project.zoomIn")}
          onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
        >
          <ZoomIn size={16} />
        </Action>
        <Action
          aria-label={text("project.fit")}
          title={text("project.fit")}
          onClick={fit}
        >
          <Maximize size={16} />
          {text("project.fit")}
        </Action>
        <Action onClick={() => setShowHistory(true)}>
          <History size={15} />
          {text("project.history")}
        </Action>
      </div>
      {viewVersion && (
        <p className="project-helper">{text("project.historicalStatus")}</p>
      )}
      {connectFrom && (
        <div className="project-notice">
          {text("project.connectHint")}{" "}
          <Action onClick={() => setConnectFrom("")}>{text("cancel")}</Action>
        </div>
      )}
      <p className="project-helper">
        {text("project.multiSelectHint")}
        {multiSelected.length > 0 && ` · ${multiSelected.length}`}
      </p>
      <div className="project-editor-body">
        <div
          ref={canvas}
          className="project-canvas"
          tabIndex={0}
          aria-label={text("project.blueprint")}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if ((e.metaKey || e.ctrlKey) && e.key === "z" && editable) {
              e.preventDefault();
              undoChange(!e.shiftKey);
            }
          }}
          onPointerCancel={e => cancelGesture(e.pointerId)}
          onLostPointerCapture={e => cancelGesture(e.pointerId)}
          onPointerDown={(e) => {
            if (e.button !== 0 || gesture.current || e.target !== e.currentTarget) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const start = { x:e.clientX, y:e.clientY };
            if (e.shiftKey || boxSelect) {
              gesture.current = { kind:"box", pointerId:e.pointerId, start };
              const rect = e.currentTarget.getBoundingClientRect();
              const x = start.x - rect.left, y = start.y - rect.top;
              setSelectionBox({ x, y, endX:x, endY:y });
            } else {
              gesture.current = { kind:"pan", pointerId:e.pointerId, start, pan };
            }
          }}
          onPointerMove={(e) => {
            const active = gesture.current;
            if (!active || active.pointerId !== e.pointerId) return;
            if (active.kind === "node") {
              setNodePreview({ id:active.id, position:draggedPosition(active,e.clientX,e.clientY) });
            } else if (active.kind === "pan") {
              setPan({
                x:active.pan.x + e.clientX - active.start.x,
                y:active.pan.y + e.clientY - active.start.y,
              });
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              setSelectionBox({
                x:active.start.x - rect.left, y:active.start.y - rect.top,
                endX:e.clientX - rect.left, endY:e.clientY - rect.top,
              });
            }
          }}
          onPointerUp={(e) => {
            const active = gesture.current;
            if (!active || active.pointerId !== e.pointerId) return;
            gesture.current = null;
            if (active.kind === "node") {
              setNodePreview(null);
              const position = draggedPosition(active,e.clientX,e.clientY);
              if (position.x === active.position.x && position.y === active.position.y) return;
              const latest = graphRef.current;
              if (latest.nodes.some(n => n.id === active.id)) {
                change({...latest, nodes:latest.nodes.map(n => n.id === active.id ? {...n,position} : n)});
              }
            } else if (active.kind === "pan") {
              if (active.start.x === e.clientX && active.start.y === e.clientY) {
                selectNode("");
              }
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              const box = {
                x:active.start.x - rect.left, y:active.start.y - rect.top,
                endX:e.clientX - rect.left, endY:e.clientY - rect.top,
              };
              const ids = displayed.nodes
                .filter((n) => {
                  const x = n.position.x * zoom + pan.x,
                    y = n.position.y * zoom + pan.y;
                  return (
                    x + 250 * zoom >= Math.min(box.x, box.endX) &&
                    x <= Math.max(box.x, box.endX) &&
                    y + 130 * zoom >= Math.min(box.y, box.endY) &&
                    y <= Math.max(box.y, box.endY)
                  );
                })
                .map((n) => n.id);
              setMultiSelected(ids);
              setSelected(ids[0] || "");
              setEdgeID("");
              setSelectionBox(null);
              setBoxSelect(false);
            }
          }}
        >
          {selectionBox && (
            <div
              className="project-selection-box"
              style={{
                left: Math.min(selectionBox.x, selectionBox.endX),
                top: Math.min(selectionBox.y, selectionBox.endY),
                width: Math.abs(selectionBox.endX - selectionBox.x),
                height: Math.abs(selectionBox.endY - selectionBox.y),
              }}
            />
          )}
          {!displayed.nodes.length && (
            <div className="project-canvas-empty">
              <GitBranch size={40} />
              <h3>{text("project.emptyCanvas")}</h3>
              <p>{text("project.emptyCanvasHint")}</p>
            </div>
          )}
          <div
            className="project-canvas-world"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <svg className="project-edges" width="12000" height="12000">
              <defs>
                <marker
                  id="blueprint-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" />
                </marker>
              </defs>
              {displayed.edges.map((e) => {
                const a = displayed.nodes.find((n) => n.id === e.from),
                  b = displayed.nodes.find((n) => n.id === e.to);
                if (!a || !b) return null;
                const x = a.position.x + 250,
                  y = a.position.y + 65,
                  bx = b.position.x,
                  by = b.position.y + 65;
                return (
                  <g
                    key={e.id}
                    className={edgeID === e.id ? "selected" : ""}
                    role="button"
                    tabIndex={0}
                    aria-label={`${a.title} → ${b.title}`}
                    onKeyDown={event => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      selectEdge(e.id);
                    }}
                    onClick={() => selectEdge(e.id)}
                  >
                    <path
                      className="edge-hit"
                      d={`M${x},${y} C${x + 80},${y} ${bx - 80},${by} ${bx},${by}`}
                    />
                    <path
                      className="edge-line"
                      markerEnd="url(#blueprint-arrow)"
                      d={`M${x},${y} C${x + 80},${y} ${bx - 80},${by} ${bx},${by}`}
                    />
                  </g>
                );
              })}
            </svg>
            {displayed.nodes.map((n) => {
              const issue = issues.find((i) => i.id === n.issue_id);
              return (
                <article
                  key={n.id}
                  className={`project-node ${selected === n.id || multiSelected.includes(n.id) ? "selected" : ""} ${n.issue_id ? "" : "new"}`}
                  style={{ left: n.position.x, top: n.position.y }}
                  tabIndex={0}
                  onClick={(event) => {
                    if (event.shiftKey) {
                      const ids = multiSelected.length ? multiSelected : selected ? [selected] : [];
                      const next = ids.includes(n.id) ? ids.filter(id => id !== n.id) : [...ids,n.id];
                      setMultiSelected(next);
                      setSelected(next.at(-1) || "");
                      setEdgeID("");
                      return;
                    }
                    if (connectFrom) addEdge(connectFrom, n.id);
                    else selectNode(n.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget || e.key !== "Enter") return;
                    e.preventDefault();
                    if (connectFrom) addEdge(connectFrom, n.id);
                    else selectNode(n.id);
                  }}
                  onPointerDown={(e) => {
                    if (
                      !editable || e.button !== 0 || gesture.current ||
                      e.shiftKey || connectFrom ||
                      (e.target instanceof Element && e.target.closest("button"))
                    )
                      return;
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    gesture.current = {
                      kind:"node", pointerId:e.pointerId, id:n.id,
                      start:{x:e.clientX,y:e.clientY}, position:n.position, scale:zoom,
                    };
                  }}
                >
                  <div className="project-node-meta">
                    <span>
                      {issue?.identifier ||
                        text(
                          n.issue_id ? "project.existing" : "project.proposed",
                        )}
                    </span>
                    {issue && <Status value={issue.status} />}
                  </div>
                  <strong>{n.title}</strong>
                  <p>
                    {text("project.assignee")}：
                    {people.name(n.assignee_id || null)}
                  </p>
                  <p>{text("project.dueDate")}：{n.due_date || text("notSet")}</p>
                  {editable && (
                    <button
                      className="project-link-handle"
                      title={text("project.connect")}
                      aria-label={text("project.connect")}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConnectFrom(n.id);
                      }}
                    >
                      <Link2 size={14} />
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </div>
        <aside className="project-inspector">
          {node ? (
            <>
              <div className="project-inspector-title">
                <h3>{text("project.taskDetails")}</h3>
                {node.issue_id && (!viewVersion || issues.some(issue => issue.id === node.issue_id)) && (
                  <Action onClick={() => onOpen(node.issue_id)}>
                    {text("open")}
                  </Action>
                )}
              </div>
              {!node.issue_id && (
                <p className="project-notice">
                  {text("project.generatedOnPublish")}
                </p>
              )}
              <Field label={text("project.title")}>
                <Input
                  disabled={!editable}
                  value={node.title}
                  onChange={(e) => patchNode({ title: e.target.value })}
                />
              </Field>
              <Field label={text("project.requirements")}>
                <Textarea
                  rows={6}
                  disabled={!editable}
                  value={node.requirements}
                  onChange={(e) => patchNode({ requirements: e.target.value })}
                />
              </Field>
              {node.baseline?.description && (
                <details>
                  <summary>{text("project.originalInput")}</summary>
                  <p className="project-original">
                    {displayProjectRequirements(node.baseline.description)}
                  </p>
                </details>
              )}
              <Field label={text("project.assignee")}>
                <Picker
                  disabled={!editable}
                  label={text("project.assignee")}
                  value={
                    node.assignee_id
                      ? `${node.assignee_type}:${node.assignee_id}`
                      : "none"
                  }
                  options={people.options}
                  onChange={(v) => {
                    const [type, id] = v.split(":");
                    patchNode({
                      assignee_type: id ? type : "",
                      assignee_id: id || "",
                    });
                  }}
                />
              </Field>
              <p className="project-helper">{text("project.noDispatchHint")}</p>
              <Field label={text("project.dueDate")}>
                <Input
                  type="date"
                  disabled={!editable}
                  value={node.due_date}
                  onChange={(e) => patchNode({ due_date: e.target.value })}
                />
              </Field>
              <h4>{text("project.predecessors")}</h4>
              {displayed.edges
                .filter((e) => e.to === node.id)
                .map((e) => (
                  <button
                    key={e.id}
                    className="project-predecessor"
                    onClick={() => selectEdge(e.id)}
                  >
                    {displayed.nodes.find((n) => n.id === e.from)?.title} →{" "}
                    {node.title}
                  </button>
                ))}
              {editable && (
                <Picker
                  label={text("project.addPredecessor")}
                  value=""
                  options={graph.nodes
                    .filter((n) => validEdge(graph, n.id, node.id))
                    .map((n) => ({ value: n.id, label: n.title }))}
                  onChange={(v) => addEdge(v, node.id)}
                />
              )}
              {editable && (
                <Action
                  onClick={() => {
                    if (!window.confirm(text("project.removeConfirm"))) return;
                    change({
                      ...graph,
                      nodes: graph.nodes.filter((n) => n.id !== node.id),
                      edges: graph.edges.filter(
                        (e) => e.from !== node.id && e.to !== node.id,
                      ),
                    });
                    selectNode("");
                  }}
                >
                  <Trash2 size={15} />
                  {text("project.removeNode")}
                </Action>
              )}
            </>
          ) : edge ? (
            <>
              <h3>{text("project.dependency")}</h3>
              <p>
                {displayed.nodes.find((n) => n.id === edge.from)?.title} →{" "}
                {displayed.nodes.find((n) => n.id === edge.to)?.title}
              </p>
              <Field label={text("project.handoff")}>
                <Textarea
                  disabled={!editable}
                  value={edge.handoff}
                  onChange={(e) =>
                    change({
                      ...graph,
                      edges: graph.edges.map((v) =>
                        v.id === edge.id
                          ? { ...v, handoff: e.target.value }
                          : v,
                      ),
                    })
                  }
                />
              </Field>
              {editable && (
                <Action
                  onClick={() => {
                    change({
                      ...graph,
                      edges: graph.edges.filter((e) => e.id !== edge.id),
                    });
                    setEdgeID("");
                  }}
                >
                  <Trash2 size={15} />
                  {text("project.removeEdge")}
                </Action>
              )}
            </>
          ) : (
            <div className="project-inspector-empty">
              <GitBranch size={28} />
              <h3>{text("project.selectNode")}</h3>
              <p>{text("project.directionHint")}</p>
            </div>
          )}
        </aside>
      </div>
      {planning && draft && (
        <ProjectPlanning
          project={project}
          draft={draft}
          selectedNodes={
            multiSelected.length ? multiSelected : selected ? [selected] : []
          }
          onClose={() => setPlanning(false)}
          onApplied={async () => {
            const response = await teamApi.getBlueprintDraft(project.id);
            if (response.draft) {
              setHistory((h) => [
                ...h,
                { before: graphRef.current, after: response.draft!.graph },
              ]);
              setRedo([]);
              synced(response.draft);
            }
          }}
        />
      )}
      {starting && (
        <ProjectStart
          project={project}
          localUnpublished={unpublished}
          onClose={() => setStarting(false)}
          onViewChanges={() => setStarting(false)}
        />
      )}
      {adding && (
        <Modal
          className="mw-blueprint-dialog mw-blueprint-candidates"
          title={text("project.includeExisting")}
          onClose={() => {
            if (!include.isPending) setAdding(false);
          }}
        >
          <div className="mw-blueprint-dialog-body">
            <Input
              autoFocus
              aria-label={text("search")}
              placeholder={text("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Failure error={existing.error || include.error} />
            <div className="project-candidate-list">
              {candidates.map((i) => (
                <button
                  key={i.id}
                  disabled={include.isPending}
                  onClick={() => include.mutate(i)}
                >
                  <span>
                    <strong>{i.title}</strong>
                    <small>
                      {i.identifier} ·{" "}
                      {i.project_id ? project.title : text("project.noProject")}
                    </small>
                  </span>
                  <Plus size={17} />
                </button>
              ))}
              {existing.isPending && <Empty>{text("loading")}</Empty>}
              {existing.isSuccess && !candidates.length && <Empty>{text("project.noCandidates")}</Empty>}
            </div>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal
          wide
          focusClose
          className="mw-blueprint-dialog mw-blueprint-preview"
          title={`${text("project.reviewPublish")} V${preview.version}`}
          onClose={() => setPreview(null)}
        >
          <div className="mw-blueprint-dialog-body">
            <p>{text("project.publishHint")}</p>
            <div className="project-change-list">
              {preview.changes.map((c, i) => (
                <div key={`${c.node_id}-${i}`}>
                  <span className={`project-change-${c.kind}`}>
                    {text(`project.change.${c.kind}`)}
                  </span>
                  <strong>{c.title}</strong>
                  <ProjectChangeDetails
                    before={current?.graph || emptyGraph()}
                    after={preview.graph}
                    id={c.node_id}
                    name={people.name}
                  />
                </div>
              ))}
            </div>
            <Field label={text("project.publishReason")}>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <PlanFailure error={action.error} />
            <Action
              primary
              disabled={action.isPending}
              onClick={() => action.mutate("publish")}
            >
              {text("project.publish")} V{preview.version}
            </Action>
          </div>
        </Modal>
      )}
      {showHistory && (
        <Modal
          wide
          className="mw-blueprint-dialog mw-blueprint-history"
          title={text("project.history")}
          onClose={() => setShowHistory(false)}
        >
          <div className="mw-blueprint-dialog-body">
            {versions.map((v, i) => (
              <article className="project-version" key={v.id}>
                <div>
                  <h3>
                    V{v.number} · {v.reason || text("project.planPublished")}
                  </h3>
                  <small>
                    {people.name(v.published_by)} ·{" "}
                    {new Date(v.created_at).toLocaleString()}
                  </small>
                </div>
                <Action
                  onClick={() => {
                    setConnectFrom("");
                    selectNode("");
                    setViewVersion(v);
                    setShowHistory(false);
                  }}
                >
                  {text("project.viewVersion")}
                </Action>
                <ul>
                  {describeChanges(
                    versions[i + 1]?.graph || emptyGraph(),
                    v.graph,
                  ).map((c, j) => (
                    <li key={j}>
                      {text(`project.change.${c.kind}`)} ·{" "}
                      {c.title || text("project.dependency")}
                      <ProjectChangeDetails
                        before={versions[i + 1]?.graph || emptyGraph()}
                        after={v.graph}
                        id={c.id}
                        name={people.name}
                      />
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            {!versions.length && <Empty>{text("project.noVersions")}</Empty>}
          </div>
        </Modal>
      )}
      {conflict && (
        <Modal wide title={text("project.conflict")} onClose={() => {}}>
          <p>{text("project.conflictHint")}</p>
          {conflict.conflicts.map((c) => (
            <div className="project-conflict" key={c.path}>
              <strong>{conflictLabel(c.path)}</strong>
              <label>
                <input
                  type="radio"
                  name={c.path}
                  checked={choices[c.path] === "local"}
                  onChange={() => setChoices({ ...choices, [c.path]: "local" })}
                />
                {text("project.keepLocal")}
                <pre>{conflictValue(c.path, c.local)}</pre>
              </label>
              <label>
                <input
                  type="radio"
                  name={c.path}
                  checked={choices[c.path] === "remote"}
                  onChange={() =>
                    setChoices({ ...choices, [c.path]: "remote" })
                  }
                />
                {text("project.keepRemote")}
                <pre>{conflictValue(c.path, c.remote)}</pre>
              </label>
            </div>
          ))}
          <Action
            primary
            disabled={conflict.conflicts.some((c) => !choices[c.path])}
            onClick={() => {
              const merged = mergeGraphs(
                conflict.base,
                conflict.local,
                conflict.remote.graph,
                choices,
              );
              baseRef.current = conflict.remote;
              setDraft(conflict.remote);
              setGraph(merged.graph);
              setConflict(null);
              setChoices({});
              setError(null);
            }}
          >
            {text("project.applyMerge")}
          </Action>
        </Modal>
      )}
    </section>
  );
}
