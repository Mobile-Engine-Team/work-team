// Blueprint presentation and canvas controls adapted from dsh-team-workbench.
import React, { useRef, useState } from "react";
import { Sparkles, Play, Plus, Undo2, Redo2, Maximize, LayoutGrid, Link2, History, Trash2, ZoomIn, ZoomOut, GitBranch, Check } from "lucide-react";
import { getWorkspace, useWorkspace, type Project } from "./store";
import { useIdentity } from "../local-identity";
import { Action, Empty, Field, Input, Modal, Picker, PlanFailure, Status, Textarea, text } from "./project-reference-ui";
import { ProjectStart } from "./project-tasks";
import { ProjectPlanning } from "./project-planning-preview";
import { ProjectChangeDetails } from "./project-change-details";
import { describeChanges, emptyGraph, graphEqual, planEqual, layoutGraph, newNode, validEdge } from "./project-blueprint-model";
import { toGraph, saveDraft, publishDraft, validateDraft, issueSummary, taskFields, type BlueprintGraph, type BlueprintNode } from "./project-blueprint-store";

const displayProjectRequirements = (value: string) => value.replace(/<!-- \/?mw-blueprint-requirements -->/g, "");
const positionFor = (count: number) => ({ x: 80 + count % 4 * 300, y: 80 + Math.floor(count / 4) * 170 });
type Step = { before: BlueprintGraph; after: BlueprintGraph };
type Version = { id: number; number: number; graph: BlueprintGraph; reason?: string; published_by: string; created_at: string };

export function ProjectBlueprint({ project, onTask }: { project: Project; onTask: (id: number) => void }) {
  const data = useWorkspace(), who = useIdentity();
  const versions: Version[] = [...(project.blueprint?.versions || [])].reverse().map(v => ({ id: v.number, number: v.number,
    graph: toGraph(v.nodes, data), reason: v.note, published_by: v.author || '', created_at: v.createdAt || '' }));
  const current = versions[0];
  const [editing, setEditing] = useState(!!project.blueprint?.draft);
  const [graph, setGraph] = useState(() => toGraph(project.blueprint?.draft ?? project.blueprint?.versions.at(-1)?.nodes ?? [], data));
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const [error, setError] = useState('');
  const [multiSelected, setMultiSelected] = useState<string[]>([]), [boxSelect, setBoxSelect] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ x:number; y:number; endX:number; endY:number } | null>(null);
  const [selected, setSelected] = useState(''), [edgeID, setEdgeID] = useState(''), [connectFrom, setConnectFrom] = useState('');
  const [adding, setAdding] = useState(false), [search, setSearch] = useState('');
  const [history, setHistory] = useState<Step[]>([]), [redo, setRedo] = useState<Step[]>([]);
  const [preview, setPreview] = useState<{ version: number; graph: BlueprintGraph; changes: ReturnType<typeof describeChanges> } | null>(null), [reason, setReason] = useState('');
  const [planning, setPlanning] = useState(false), [starting, setStarting] = useState(false);
  const [showHistory, setShowHistory] = useState(false), [viewVersion, setViewVersion] = useState<Version | null>(null);
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState({ x: 20, y: 20 });
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id:string; x:number; y:number; original:BlueprintGraph; pan:{ x:number; y:number } } | null>(null);
  const editable = editing && !viewVersion;
  const unpublished = !!current && editing && !planEqual(graph, current.graph);
  const displayed = viewVersion?.graph || (editable ? graph : current?.graph) || emptyGraph();
  const author = viewVersion?.published_by || (editable ? project.blueprint?.draftAuthor || who : current?.published_by || project.lead);
  const node = displayed.nodes.find(n => n.id === selected), edge = displayed.edges.find(e => e.id === edgeID);
  const excluded = new Set(graph.nodes.map(n => n.issue_id));
  const issues = data.issues.filter(i => !i.archived).map(issueSummary);
  const candidates = issues.filter(i => (!i.project_id || i.project_id === project.name) && !excluded.has(i.id)
    && `${i.title} ${i.identifier}`.toLowerCase().includes(search.trim().toLowerCase()));
  const people = { name: (name: string | null) => name || '无负责人', options: [{ value:'none', label:'无负责人' }, ...[...new Set([
    who, ...data.members.map(m => m.name), ...data.agents.map(a => a.name), ...data.squads.map(s => s.name), ...graph.nodes.map(n => n.assignee_id),
  ])].filter(n => n && n !== '无负责人').map(name => ({value: `${taskFields({ assignee:name }, data).assignee_type}:${encodeURIComponent(name)}`, label:name}))] };

  function persist(next: BlueprintGraph) { saveDraft(project.name, next, who); }
  function change(next: BlueprintGraph) {
    if (graphEqual(graphRef.current, next)) return;
    const before = graphRef.current;
    setHistory(h => [...h.slice(-49), { before, after:next }]);
    setRedo([]); setGraph(next); persist(next); setError('');
  }
  function patchNode(patch: Partial<BlueprintNode>) {
    change({ ...graph, nodes: graph.nodes.map(n => n.id === selected ? { ...n, ...patch } : n) });
  }
  function undoChange(back: boolean) {
    const step = (back ? history : redo).at(-1);
    if (!step) return;
    const next = back ? step.before : step.after;
    setGraph(next); persist(next); setError('');
    if (back) { setHistory(h => h.slice(0, -1)); setRedo(h => [...h, step]); }
    else { setRedo(h => h.slice(0, -1)); setHistory(h => [...h, step]); }
  }
  function addEdge(from: string, to: string) {
    if (!validEdge(graph, from, to)) { setError(text('project.invalidEdge')); return; }
    change({ ...graph, edges:[...graph.edges, { id:crypto.randomUUID(), from, to, handoff:'' }] });
    setConnectFrom('');
  }
  function fit() {
    const width = canvas.current?.clientWidth || 800, height = canvas.current?.clientHeight || 600;
    const left = Math.min(0, ...displayed.nodes.map(n => n.position.x));
    const top = Math.min(0, ...displayed.nodes.map(n => n.position.y));
    const maxX = Math.max(500, ...displayed.nodes.map(n => n.position.x + 280));
    const maxY = Math.max(300, ...displayed.nodes.map(n => n.position.y + 150));
    const next = Math.min(1.2, Math.max(.15, Math.min((width - 60) / (maxX - left), (height - 60) / (maxY - top))));
    setZoom(next); setPan({ x:20 - left * next, y:20 - top * next });
  }
  function selectNewNode(n:BlueprintNode) {
    setSelected(n.id); setEdgeID(''); setMultiSelected([]);
    if (!canvas.current) return;
    const left = pan.x + n.position.x * zoom, top = pan.y + n.position.y * zoom;
    if (left < 0 || top < 0 || left + 260 * zoom > canvas.current.clientWidth || top + 140 * zoom > canvas.current.clientHeight) {
      setPan({x:40 - n.position.x * zoom, y:40 - n.position.y * zoom});
    }
  }
  function include(i: ReturnType<typeof issueSummary>) {
    const source = data.issues.find(issue => String(issue.id) === i.id);
    if (!source) return;
    const fields = taskFields(source, data);
    const n = { ...newNode(i.title), ...fields, issue_id:i.id, baseline:{ ...fields, description:source.description }, position:positionFor(graph.nodes.length) };
    change({ ...graph, nodes:[...graph.nodes, n] }); selectNewNode(n);
  }
  const action = { mutate(mode: string) {
    if (mode === 'edit') { const next = project.blueprint?.draft ? toGraph(project.blueprint.draft, data) : current?.graph || emptyGraph(); setGraph(next); persist(next); setEditing(true); }
    if (mode === 'planning') setPlanning(true);
    if (mode === 'refresh' && window.confirm(text('project.refreshConfirm'))) {
      const latest = getWorkspace();
      const conflicts: string[] = [];
      const nodes = graph.nodes.map(n => {
        const issue = latest.issues.find(i => String(i.id) === n.issue_id);
        if (!issue || issue.archived) return n;
        const fields = taskFields(issue, latest), baseline = n.baseline;
        if (!baseline) return { ...n, baseline:{ ...fields, description:issue.description } };
        const concurrent = (keys: (keyof typeof fields)[]) => keys.some(key => n[key] !== baseline[key])
          && keys.some(key => fields[key] !== baseline[key]) && keys.some(key => n[key] !== fields[key]);
        if (concurrent(['title']) || concurrent(['requirements']) || concurrent(['assignee_id','assignee_type']) || concurrent(['due_date'])) {
          conflicts.push(n.title);
          return n;
        }
        const retained = (keys: (keyof typeof fields)[]) => keys.some(key => n[key] !== baseline[key]);
        return { ...n, ...fields,
          ...(retained(['title']) ? { title:n.title } : {}),
          ...(retained(['requirements']) ? { requirements:n.requirements } : {}),
          ...(retained(['assignee_id','assignee_type']) ? { assignee_id:n.assignee_id, assignee_type:n.assignee_type } : {}),
          ...(retained(['due_date']) ? { due_date:n.due_date } : {}),
          baseline:{ ...fields, description:issue.description },
        };
      });
      change({ ...graph, nodes });
      if (conflicts.length) setError(`任务与草案同时修改了同一字段：${conflicts.join('、')}。草案已保留，请先将该字段改为任务的最新内容，再同步并继续编辑。`);
    }
    if (mode === 'preview') {
      const invalid = validateDraft(project, graph, getWorkspace());
      if (invalid) {setError(invalid); return;}
      setError(''); setReason('');
      setPreview({ version:(current?.number || 0) + 1, graph, changes:describeChanges(current?.graph || emptyGraph(), graph) });
    }
    if (mode === 'publish' && preview) {
      try {
        publishDraft(project.name, preview.version, preview.graph, reason, who);
        setError(''); setPreview(null); setEditing(false); setConnectFrom(''); setHistory([]); setRedo([]);
      } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    }
  }};
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
            {text("project.saved")}{author && ` · ${author}`}
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
              <span className="project-save-confirm" role="status"><Check size={15} />{text("project.saved")}</span>
              <Action primary onClick={() => action.mutate("preview")}>
                {text("project.reviewPublish")}
              </Action>
            </>
          ) : (
            <Action primary onClick={() => action.mutate("edit")}>
              {text("project.editDraft")}
            </Action>
          )}
        </div>
      </div>
      <PlanFailure error={error} />
      <div className="project-canvas-tools">
        {editable && (
          <>
            <Action
              onClick={() => {
                const n = { ...newNode(text("project.untitled")), position:positionFor(graph.nodes.length) };
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
            onClick={() => action.mutate("refresh")}
          >
            {text("project.refreshContracts")}
          </Action>
        )}
        {editable && (
          <Action
            onClick={() => action.mutate("planning")}
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
            setSelected(id);
            setEdgeID("");
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
        <span aria-label="缩放比例">{Math.round(zoom * 100)}%</span>
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
          onPointerCancel={() => {
            const d = drag.current; drag.current = null; setSelectionBox(null);
            if (d?.id) setGraph(d.original);
          }}
          tabIndex={0}
          aria-label={text("project.blueprint")}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if ((e.metaKey || e.ctrlKey) && e.key === "z" && editable) {
              e.preventDefault();
              undoChange(!e.shiftKey);
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 || e.target !== e.currentTarget) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            if (e.shiftKey || boxSelect) {
              const rect = e.currentTarget.getBoundingClientRect();
              setSelectionBox({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                endX: e.clientX - rect.left,
                endY: e.clientY - rect.top,
              });
              return;
            }
            setMultiSelected([]);
            drag.current = {
              id: "",
              x: e.clientX,
              y: e.clientY,
              original: graph,
              pan,
            };
          }}
          onPointerMove={(e) => {
            if (selectionBox) {
              const rect = e.currentTarget.getBoundingClientRect();
              setSelectionBox({
                ...selectionBox,
                endX: e.clientX - rect.left,
                endY: e.clientY - rect.top,
              });
              return;
            }
            const d = drag.current;
            if (!d) return;
            if (!d.id) {
              setPan({
                x: d.pan.x + e.clientX - d.x,
                y: d.pan.y + e.clientY - d.y,
              });
              return;
            }
            const n = d.original.nodes.find((n) => n.id === d.id);
            if (n) {
              const next = {
                ...graphRef.current,
                nodes: graphRef.current.nodes.map((v) =>
                  v.id === d.id
                    ? {
                        ...v,
                        position: {
                          x: Math.max(
                            0,
                            n.position.x + (e.clientX - d.x) / zoom,
                          ),
                          y: Math.max(
                            0,
                            n.position.y + (e.clientY - d.y) / zoom,
                          ),
                        },
                      }
                    : v,
                ),
              };
              graphRef.current = next;
              setGraph(next);
            }
          }}
          onPointerUp={(e) => {
            if (selectionBox) {
              const rect = e.currentTarget.getBoundingClientRect();
              const box = {
                ...selectionBox,
                endX: e.clientX - rect.left,
                endY: e.clientY - rect.top,
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
              setSelectionBox(null);
              setBoxSelect(false);
              return;
            }
            const d = drag.current;
            if (d?.id && !graphEqual(d.original, graphRef.current)) {
              const after = graphRef.current;
              setHistory((h) => [...h.slice(-49), { before: d.original, after }]);
              setRedo([]);
            }
            drag.current = null;
            if (d?.id && !graphEqual(d.original, graphRef.current)) persist(graphRef.current);
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault(); setEdgeID(e.id); setSelected("");
                      }
                    }}
                    onClick={() => {
                      setEdgeID(e.id);
                      setSelected("");
                    }}
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
                      setMultiSelected((ids) =>
                        ids.includes(n.id)
                          ? ids.filter((id) => id !== n.id)
                          : [...ids, n.id],
                      );
                      setSelected(n.id);
                      return;
                    }
                    setMultiSelected([]);
                    if (connectFrom) {
                      addEdge(connectFrom, n.id);
                      return;
                    }
                    setSelected(n.id);
                    setEdgeID("");
                  }}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && e.key === "Enter") {
                      if (connectFrom) addEdge(connectFrom, n.id);
                      else { setSelected(n.id); setEdgeID(""); }
                    }
                  }}
                  onPointerDown={(e) => {
                    if (
                      !editable ||
                      e.button !== 0 ||
                      e.shiftKey ||
                      connectFrom ||
                      (e.target as Element).closest("button")
                    )
                      return;
                    e.stopPropagation();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    drag.current = {
                      id: n.id,
                      x: e.clientX,
                      y: e.clientY,
                      original: graphRef.current,
                      pan,
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
                      type="button"
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
                {node.issue_id && (
                  <Action onClick={() => onTask(Number(node.issue_id))}>
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
                  aria-label={text("project.title")}
                  value={node.title}
                  onChange={(e) => patchNode({ title: e.target.value })}
                />
              </Field>
              <Field label={text("project.requirements")}>
                <Textarea
                  rows={6}
                  disabled={!editable}
                  aria-label={text("project.requirements")}
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
                      ? `${node.assignee_type}:${encodeURIComponent(node.assignee_id)}`
                      : "none"
                  }
                  options={people.options}
                  onChange={(v) => {
                    const [type, id] = v.split(":");
                    patchNode({
                      assignee_type: id ? type : "",
                      assignee_id: id ? decodeURIComponent(id) : "",
                    });
                  }}
                />
              </Field>
              <p className="project-helper">{text("project.noDispatchHint")}</p>
              <Field label={text("project.dueDate")}>
                <Input
                  type="date"
                  disabled={!editable}
                  aria-label={text("project.dueDate")}
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
                    onClick={() => {
                      setSelected("");
                      setEdgeID(e.id);
                    }}
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
                    if (node.issue_id && !window.confirm(text("project.removeConfirm"))) return;
                    change({
                      ...graph,
                      nodes: graph.nodes.filter((n) => n.id !== node.id),
                      edges: graph.edges.filter(
                        (e) => e.from !== node.id && e.to !== node.id,
                      ),
                    });
                    setSelected("");
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
                  aria-label={text("project.handoff")}
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
      {planning && <ProjectPlanning graph={graph} project={project} selectedNodes={multiSelected.length ? multiSelected : selected ? [selected] : []}
        onClose={() => setPlanning(false)} onApply={(next) => {change(next);setPlanning(false);}} />}
      {starting && <ProjectStart project={project} onClose={() => setStarting(false)} onViewChanges={() => {setStarting(false); if (!editable) action.mutate("edit");}} />}
      {adding && (
        <Modal
          title={text("project.includeExisting")}
          onClose={() => setAdding(false)}
        >
          <Input
            placeholder={text("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="project-candidate-list">
            {candidates.map((i) => (
              <button
                key={i.id}
                onClick={() => include(i)}
              >
                <span>
                  <strong>{i.title}</strong>
                  <small>
                    {i.identifier} ·{" "}
                    {i.project_id ? project.name : text("project.noProject")}
                  </small>
                </span>
                <Plus size={17} />
              </button>
            ))}
            {!candidates.length && (
              <Empty>{text("project.noCandidates")}</Empty>
            )}
          </div>
        </Modal>
      )}
      {preview && (
        <Modal
          wide
          title={`${text("project.reviewPublish")} V${preview.version}`}
          onClose={() => setPreview(null)}
        >
          <p>{text("project.publishHint")}</p>
          <div className="project-change-list">
            {preview.changes.map((c, i) => (
              <div key={`${c.id}-${i}`}>
                <span className={`project-change-${c.kind}`}>
                  {text(`project.change.${c.kind}`)}
                </span>
                <strong>{c.title}</strong>
                <ProjectChangeDetails
                  before={current?.graph || emptyGraph()}
                  after={preview.graph}
                  id={c.id}
                  name={people.name}
                />
              </div>
            ))}
          </div>
          <Field label={text("project.publishReason")}>
            <Textarea
              aria-label={text("project.publishReason")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <PlanFailure error={error} />
          <Action
            primary
            onClick={() => action.mutate("publish")}
          >
            {text("project.publish")} V{preview.version}
          </Action>
        </Modal>
      )}
      {showHistory && (
        <Modal
          wide
          title={text("project.history")}
          onClose={() => setShowHistory(false)}
        >
          {versions.map((v, i) => (
            <article className="project-version" key={v.id}>
              <div>
                <h3>
                  V{v.number} · {v.reason || text("project.planPublished")}
                </h3>
                <small>
                  {people.name(v.published_by)} ·{" "}
                  {v.created_at ? new Date(v.created_at).toLocaleString() : "—"}
                </small>
              </div>
              <Action
                onClick={() => {
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
        </Modal>
      )}
    </section>
  );
}
