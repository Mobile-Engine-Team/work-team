import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { UpdateIssueRequest } from "@multica/core/types";
import { z } from "zod";
import { IssueTableRowsResponseSchema } from "@multica/core/api/schemas";
import { MoreHorizontal, Pin, Pencil, Copy, Trash2, Columns3, List, Download, ListTodo, Table2, Ban, Circle, CircleCheck, CircleDot, Flag, Folder, Layers, Check, ChevronDown, ChevronRight, Plus, Search, ArrowUpDown, X } from "../icons";
import { ClipboardCheck, ListFilter, Waves } from "lucide-react";
import {
  teamApi,
  teamServer,
  text,
  useTeam,
  useTeamQuery,
  useTeamAction,
} from "./client";
import { teamFetch } from "./request-transport";
import { useTeamPeople, useStatuses } from "./tasks";
import { Action, Empty, Failure, Field, Input, Modal, Picker, Status } from "./ui";
import type { TeamDraft } from "./draft";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { copyIssue } from "./task-properties";
import { splitProjectRequirements } from "./project-requirements";
import { TaskDate } from "./task-date";
import { TaskTableLabels } from "./task-table-labels";
import "./task-board.css";

const statusColors: Record<string, string> = {
  backlog:"#929ba8", todo:"#73829b", in_progress:"#e4a128", in_review:"#8b6bd5",
  blocked:"#e2686b", done:"#35a780", cancelled:"#a0a7b2",
};
function BoardStatusMark({status}: {status: string}) {
  const Mark = status === "blocked" ? Ban : status === "done" ? CircleCheck : status === "in_progress" ? CircleDot : Circle;
  return <Mark className="v3-status-mark" data-status={status} size={14} aria-hidden="true" color={statusColors[status] || "#8390a2"}/>;
}

const columns = [
  ["title", "任务"],
  ["status", "状态"],
  ["priority", "优先级"],
  ["assignee", "负责人"],
  ["project", "所属项目"],
  ["start_date", "开始日期"],
  ["due_date", "截止日期"],
] as const;
const tableColumns = [...columns, ["labels", "标签"]] as const;
const cardProperties = [
  ["priority", "优先级"], ["description", "描述"], ["assignee", "负责人"], ["start_date", "开始日期"],
  ["due_date", "截止日期"], ["project", "项目"], ["labels", "标签"],
] as const;
const taskLabelNames = z.array(z.object({ name: z.string() }));
type Column = (typeof columns)[number][0];
type Option = { value: string; label: string; disabled?: boolean };
const priorities = [
  ["urgent", "紧急"],
  ["high", "高"],
  ["medium", "中"],
  ["low", "低"],
  ["none", "无优先级"],
];
const dates = [
  ["overdue", "已逾期"],
  ["today", "今天"],
  ["this_week", "本周"],
  ["next_7_days", "未来七天"],
  ["none", "无截止日期"],
];
const pairs = (items: string[][]): Option[] =>
  items.map(([value, label]) => ({ value, label }));
const layouts = [
  ["board", "看板", Columns3],
  ["list", "列表", List],
  ["table", "表格", Table2],
  ["swimlane", "泳道", Waves],
] as const;
const facets = [
  "project",
  "status",
  "owner",
  "priority",
  "due",
  "label",
] as const;
function MultiFilter({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: Option[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="v3-facet"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); }
      }}
    >
      <button
        role="combobox"
        aria-expanded={open}
        aria-label={"筛选" + label}
        onClick={() => setOpen(!open)}
      >
        {label}
        {values.length > 0 && <b>{values.length}</b>}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div role="listbox" aria-multiselectable className="v3-options">
          {options.map((o) => (
            <button
              role="option"
              aria-selected={values.includes(o.value)}
              key={o.value}
              onClick={() =>
                onChange(
                  values.includes(o.value)
                    ? values.filter((v) => v !== o.value)
                    : [...values, o.value],
                )
              }
            >
              {o.label}
              {values.includes(o.value) && <Check size={14} />}
            </button>
          ))}
          {!options.length && <small>暂无可选项</small>}
        </div>
      )}
    </div>
  );
}
export function TaskBoard({
  onCreate,
}: {
  onCreate: (
    fields?: Partial<
      Pick<TeamDraft, "status" | "priority" | "owner" | "projectID">
    >,
  ) => void;
}) {
  const { workspace, user } = useTeam(),
    people = useTeamPeople(),
    statuses = useStatuses();
  const navigate = useNavigate(),
    [params, setParams] = useSearchParams();
  const projects = useTeamQuery(["projects"], () => teamApi.listProjects());
  const pins = useTeamQuery(["task-pins", user.id], () => teamApi.listPins());
  const pinnedIds = new Set(pins.data?.filter(pin => pin.item_type === "issue").map(pin => pin.item_id));
  const labels = useTeamQuery(["labels"], () => teamApi.listLabels());
  const mine = params.get("scope") === "mine",
    layout = params.get("layout") || "board",
    search = params.get("q") || "";
  const DisplayIcon = layouts.find(([id]) => id === layout)?.[2] ?? Columns3;
  const sort =
      [...columns.map(([key]) => key), "created_at", "updated_at", "position"].find(key => key === params.get("sort")) ||
      "updated_at",
    direction =
      params.get("direction") || (sort === "position" ? "asc" : "desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [display, setDisplay] = useState(false),
    [viewDialog, setViewDialog] = useState(false),
    [viewName, setViewName] = useState("");
  useEffect(() => {
    if (!display) return;
    const outside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest("[data-task-display], [role=listbox], [data-slot=select-content]")) setDisplay(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      // A closed Base UI Select keeps an off-screen listbox mounted until focus moves.
      if (document.querySelector('[data-task-display] [role=combobox][aria-expanded=true], [role=dialog][aria-modal=true]')) return;
      event.preventDefault();
      event.stopPropagation();
      setDisplay(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [display]);
  const [removingView, setRemovingView] = useState(false);
  const [selection, setSelection] = useState<string[]>([]),
    [deleteMode, setDeleteMode] = useState(false);
  const keyValues = (key: string) => params.getAll(key);
  const [project, status, owner, priority, due, label] = facets.map(keyValues);
  const changes = (values: Record<string, string | string[]>) => {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("before");
    for (const [k, v] of Object.entries(values)) {
      next.delete(k);
      for (const item of Array.isArray(v) ? v : [v])
        if (item) next.append(k, item);
    }
    setSelection([]);
    setParams(next, { replace: true, flushSync: true });
  };
  const relation =
    params.get("relation") === "my_agents" ? "my_agents" : "assigned";
  const scope = {
    kind: mine ? "my" : "workspace",
    ...(mine ? { relation } : {}),
  };
  const grouping = params.get("group") || "status",
    hidden = params.has("hidden")
      ? params.getAll("hidden").filter((v) => v !== "none")
      : ["cancelled"],
    attrs = params.has("attr") ? params.getAll("attr").filter(key => key !== "none") : ["start_date", "description", "labels"];
  const hiddenColumns = params.has("column_hidden")
    ? params.getAll("column_hidden").filter(key => key !== "none")
    : params.has("attr") ? [...attrs, "labels"] : ["start_date", "labels"];
  const setHidden = (v: string[]) =>
    changes({ hidden: v.length ? v : ["none"] });
  const [columnMenu, setColumnMenu] = useState("");
  const [folded, setFolded] = useState<string[]>([]);
  const shownColumns = tableColumns.filter(
    ([key]) => key === "title" || !hiddenColumns.includes(key),
  );
  const filters = {
    project_ids: project.filter((p) => p !== "none"),
    include_no_project: project.includes("none"),
    statuses: status,
    assignees: !owner.length
      ? undefined
      : owner
          .filter((o) => o !== "none")
          .map((o) => {
            const [type, id] = o.split(":");
            return { type, id };
          }),
    include_no_assignee: owner.includes("none"),
    priorities: priority,
    due_dates: due,
    today: new Date().toLocaleDateString("en-CA"),
    label_ids: label,
    include_sub_issues: true,
  };
  const query = { scope, filters, search, sort: { field: sort, direction } };
  async function fetchRows(cursor: string | null) {
    const res = await teamFetch(teamServer + "/api/issues/table/rows", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-ID": workspace.id,
      },
      body: JSON.stringify({
        query,
        prioritize_pins: true,
        group: { kind: "none" },
        group_key: null,
        parent_id: null,
        hierarchy: { enabled: false },
        page: { limit: 100, cursor },
      }),
    });
    if (!res.ok) throw Error("任务查询失败（" + res.status + "）");
    const page = IssueTableRowsResponseSchema.parse(await res.json());
    return { ...page, rows: page.rows.map(row => ({
      ...row, issue: { ...row.issue, labels: taskLabelNames.parse(row.issue.labels || []),
        preview: splitProjectRequirements(row.issue.description || "").description.replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim(),
      },
    })) };
  }
  const cursor = params.get("cursor"),
    issues = useTeamQuery(["issues", "table", query, cursor, user.id], () =>
      fetchRows(cursor),
    );
  const rows = issues.data?.rows.map(r => r.issue) || [];
  type Row = (typeof rows)[number];
  const selectionScope = JSON.stringify([workspace.id, user.id, query]);
  useEffect(() => {
    setSelection([]);
    setDeleteMode(false);
  }, [selectionScope]);
  const open = (id: string, edit = false) =>
    navigate(`/team/${workspace.slug}/issue/${id}`, {
      state: {
        editTask: edit ? id : undefined,
        taskListSearch: params.toString(),
        taskIds: rows.map((r) => r.id),
      },
    });
  const value = (r: Row, col: Column | "labels") => {
    switch (col) {
      case "labels": return (r.labels || []).map(l => l.name).join(", ");
      case "assignee":
        return r.assignee_id ? people.name(r.assignee_id) : "无负责人";
      case "project":
        return (
          projects.data?.projects.find((p) => p.id === r.project_id)?.title ||
          "无关联项目"
        );
      case "status":
        return (
          statuses.options.find((s) => s.value === r.status)?.label || r.status
        );
      case "priority":
        return priorities.find(([v]) => v === r.priority)?.[1] || "无优先级";
      default:
        return r[col] || "—";
    }
  };

  const bulkOwner = useTeamAction(async (owner: string) => {
    const [type, id] = owner.split(":");
    const updates = await Promise.allSettled(
      selection.map((idToUpdate) =>
        teamApi.updateIssue(
          idToUpdate,
          owner === "none"
            ? { suppress_run: true, assignee_type: null, assignee_id: null }
            : {
                suppress_run: true,
                assignee_type: type as "member" | "agent" | "squad",
                assignee_id: id,
              },
        ),
      ),
    );
    const failed = selection.filter((_, i) => updates[i].status === "rejected");
    setSelection(failed);
    await issues.refetch();
    if (failed.length) throw Error(failed.length + " 项指派失败");
  });
  const bulk = useTeamAction(async (status: string) => {
    const results = await Promise.allSettled(
      selection.map((id) =>
        status === "delete"
          ? teamApi.deleteIssue(id)
          : teamApi.updateIssue(id, { status, suppress_run: true }),
      ),
    );
    const failed = selection.filter((_, i) => results[i].status === "rejected");
    setSelection(failed);
    setDeleteMode(false);
    await issues.refetch();
    if (failed.length) throw Error(failed.length + " 项操作失败，请重新核对。");
  });
  const existingViews = useTeamQuery(["issue-views"], () =>
    teamApi.listIssueViews({ scope_type: "workspace" }),
  );
  const activeView = existingViews.data?.find(
    (v) => v.id === params.get("saved"),
  );
  const dropView = useTeamAction(async () => {
    if (!activeView) return;
    await teamApi.deleteIssueView(activeView.id);
    changes({ saved: "" });
    setRemovingView(false);
    setViewDialog(false);
  });
  const saveView = useTeamAction(async (updateExisting: boolean) => {
    const saved = new URLSearchParams(params);
    saved.delete("cursor");
    saved.delete("before");
    saved.delete("saved");
    saved.delete("directory");
    const v =
      updateExisting && activeView
        ? await teamApi.updateIssueView(activeView.id, {
            name: viewName.trim() || activeView.name,
            expected_revision: activeView.revision,
            query: { route: saved.toString() },
            display: { layout },
          })
        : await teamApi.createIssueView({
            scope_type: "workspace",
            visibility: "private",
            name: viewName.trim(),
            definition_version: 1,
            query: { route: saved.toString() },
            display: { layout },
          });
    if (!v) throw Error("视图未保存");
    openSavedView(v.id,saved.toString());
    setViewDialog(false);
    setViewName("");
  });
  const exported = useTeamAction(async () => {
    let next: string | null = null;
    const lines: string[][] = [["任务编号", ...shownColumns.map(([, label]) => label)]];
    do {
      const page = await fetchRows(next);
      for (const row of page.rows)
        lines.push(
          [row.issue.identifier, ...shownColumns.map(([key]) => value(row.issue, key))],
        );
      next = page.next_cursor;
    } while (next);
    const escape = (s: string) =>
      '"' + (/^[=+@\-\t\r]/.test(s) ? "'" : "") + s.replaceAll('"', '""') + '"';
    const url = URL.createObjectURL(
      new Blob(
        ["\uFEFF" + lines.map((row) => row.map(escape).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "任务.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const filterOptions: Option[][] = [
    [
      { value: "none", label: "无关联项目" },
      ...(projects.data?.projects || []).map((p) => ({
        value: p.id,
        label: p.title,
      })),
    ],
    statuses.options,
    people.options,
    pairs(priorities),
    pairs(dates),
    (labels.data?.labels || []).map((l) => ({ value: l.id, label: l.name })),
  ];
  const visibleStatuses = statuses.options.filter(s => !hidden.includes(s.value));
  const optionsForGroup = (key: string): Option[] => {
    if (key === "project") return filterOptions[0];
    if (key === "priority") return pairs(priorities);
    if (key === "assignee") return people.options;
    return statuses.options;
  };
  const groupValue = (r: Row, key = grouping) => {
    if (key === "project") return r.project_id || "none";
    if (key === "priority") return r.priority;
    if (key === "assignee") return r.assignee_id ? r.assignee_type + ":" + r.assignee_id : "none";
    return r.status;
  };
  const groupPatch = (key: string, target: string): UpdateIssueRequest => {
    if (key === "project") return { project_id: target === "none" ? null : target };
    if (key === "priority") return { priority: target as TeamDraft["priority"] };
    if (key === "assignee") {
      const [type, id] = target.split(":");
      return { assignee_type: id ? type as "member" | "agent" | "squad" : null, assignee_id: id || null };
    }
    return { status: target };
  };
  const groups = grouping === "status" ? visibleStatuses : optionsForGroup(grouping);
  const tableGroup = params.get("table_group") || "none";
  const laneGroup = params.get("lane_group") === "project" ? "project" : "assignee";
  const groupedRows = (key: string, opts: Option[]) => opts.map(option => ({
    ...option, items: rows.filter(row => groupValue(row, key) === option.value),
  }));
  const tableGroups = tableGroup === "none" ? [{ value: "none", label: "", items: rows }]
    : groupedRows(tableGroup, optionsForGroup(tableGroup));
  const lanes = groupedRows(laneGroup, optionsForGroup(laneGroup)).filter(group => group.value === "none" || group.items.length);
  const reorder = useTeamAction(
    async ({
      id,
      target,
      before,
    }: {
      id: string;
      target: string;
      before: string | null;
    }) => {
      const row = rows.find((r) => r.id === id);
      if (!row || groupValue(row) !== target || before === id) return;
      const neighbors = rows
        .filter((r) => r.id !== id && groupValue(r) === target)
        .sort((a, b) => a.position - b.position);
      const index = before
        ? neighbors.findIndex((r) => r.id === before)
        : neighbors.length;
      if (index < 0) return;
      const move = {
        before_id: neighbors[index - 1]?.id ?? null,
        after_id: neighbors[index]?.id ?? null,
        expected_revision: row.revision,
      };
      await teamApi.moveIssue(id, move);
      changes({ sort: "position", direction: "asc" });
    },
  );
  const changePage = (next: string | null, previous = false) => {
    const p = new URLSearchParams(params),
      history = p.getAll("before");
    p.delete("before");
    if (previous) {
      next = history.pop() || null;
    } else history.push(cursor || "");
    history.forEach((c) => p.append("before", c));
    if (next) p.set("cursor", next);
    else p.delete("cursor");
    setParams(p);
  };
  const patchCard = useTeamAction(
    ({
      id,
      patch,
    }: {
      id: string;
      patch: UpdateIssueRequest;
    }) => teamApi.updateIssue(id, { ...patch, expected_revision: rows.find(row => row.id === id)?.revision, suppress_run: true }),
  );
  const dateField = (row: Row, column: "start_date" | "due_date", className: string) =>
    <TaskDate label={row.identifier + (column === "start_date" ? " 开始日期" : " 截止日期")}
      value={row[column] || ""} className={className} placeholder="—"
      min={column === "due_date" ? row.start_date || undefined : undefined}
      max={column === "start_date" ? row.due_date || undefined : undefined}
      onChange={day => patchCard.mutate({ id: row.id, patch: { [column]: day || null } })} />;
  const tableField = (row: Row, column: Exclude<Column, "title">, label: string) => {
    const name = row.identifier + " " + label;
    const save = (patch: UpdateIssueRequest) =>
      patchCard.mutate({ id: row.id, patch });
    if (column === "start_date" || column === "due_date") {
      return dateField(row, column, "v3-table-field");
    }
    const options = column === "status" ? statuses.options : column === "project" ? filterOptions[0]
      : column === "priority" ? pairs(priorities) : people.options;
    const current = column === "project" ? row.project_id || "none" : column === "assignee"
      ? row.assignee_id ? row.assignee_type + ":" + row.assignee_id : "none" : row[column];
    const title = value(row, column);
    return <label className="v3-table-field">
      {column === "status" ? <BoardStatusMark status={row.status}/>
        : column === "priority" ? <Flag size={14} /> : column === "project" ? <Folder size={14} />
        : <i className="v3-table-avatar">{row.assignee_id ? title.slice(0, 1) : "?"}</i>}
      <span>{title}</span>
      <select aria-label={name} value={current} onChange={event => {
        const choice = event.target.value;
        save(groupPatch(column, choice));
      }}>
        {!options.some(option => option.value === current) && <option value={current} disabled>{title}</option>}
        {(options as Option[]).map(option =>
          <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
      </select>
    </label>;
  };
  const createInColumn = (key: string, dimension = grouping, status?: string) => {
    setColumnMenu("");
    const defaults = dimension === "project"
        ? { projectID: key === "none" ? "" : key }
        : dimension === "status"
          ? { status: key }
          : dimension === "priority"
            ? { priority: key as TeamDraft["priority"] }
            : { owner: key };
    onCreate({ ...defaults, ...(status ? { status } : {}) });
  };
  const [removeTarget, setRemoveTarget] = useState<Row | null>(null);
  const rowAction = useTeamAction(async ({id, action}: {id: string; action: "pin" | "unpin" | "copy" | "delete"}) => {
    if (action === "copy") { open((await copyIssue(await teamApi.getIssue(id))).id); return; }
    if (action === "delete") {
      await teamApi.deleteIssue(id);
      setRemoveTarget(null);
      setSelection(ids => ids.filter(selected => selected !== id));
      return;
    }
    if (action === "pin") await teamApi.createPin({item_type: "issue", item_id: id});
    else await teamApi.deletePin("issue", id);
    changes({});
  });
  const rowMenu = (r: Row) => <DropdownMenu>
    <DropdownMenuTrigger render={<button className="v3-row-actions" aria-label={"任务操作 " + r.identifier} />}>
      <MoreHorizontal size={16}/>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={() => open(r.id, true)}><Pencil size={15}/>编辑任务</DropdownMenuItem>
      <DropdownMenuItem disabled={!pins.data || rowAction.isPending} onClick={() => rowAction.mutate({id:r.id,action:pinnedIds.has(r.id) ? "unpin" : "pin"})}>
        <Pin size={15}/>{pinnedIds.has(r.id) ? "取消置顶" : "置顶任务"}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={rowAction.isPending} onClick={() => rowAction.mutate({id:r.id,action:"copy"})}><Copy size={15}/>复制任务</DropdownMenuItem>
      <DropdownMenuItem onClick={() => toggleRows([r])}><Check size={15}/>选择任务</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setRemoveTarget(r)}><Trash2 size={15}/>删除任务</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
  function openRow(event: React.MouseEvent<HTMLElement>, id: string) {
    const target = event.target;
    if (!(target instanceof Element) || !event.currentTarget.contains(target)) return;
    if (target.closest("button, input, select, label, a, [role=menuitem]") || window.getSelection()?.toString()) return;
    open(id);
  }
  const card = (r: Row) => (
    <article
      className="v3-task-card"
      draggable
      data-task-id={r.id}
      key={r.id}
      tabIndex={0}
      aria-label={"打开任务 " + r.identifier + " " + r.title}
      onClick={event => openRow(event, r.id)}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault(); open(r.id);
        }
      }}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
    >
      <header>
        {!!selection.length && <input type="checkbox" checked={selection.includes(r.id)} aria-label={"选择"+r.title} onChange={() => toggleRows([r])}/>}
        <small>{r.identifier}</small>
        {pinnedIds.has(r.id) && <Pin size={12} aria-label="已置顶"/>}
        {!attrs.includes("priority") && r.priority !== "none" && (
          <label className="v3-card-priority" data-priority={r.priority}>
            <Flag size={12} />
            {value(r, "priority")}
            <select
              aria-label={r.identifier + " 优先级"}
              value={r.priority}
              onChange={(e) =>
                patchCard.mutate({
                  id: r.id,
                  patch: { priority: e.target.value as TeamDraft["priority"] },
                })
              }
            >
              {priorities.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}
        {rowMenu(r)}
      </header>
      <button className="v3-card-title" onClick={() => open(r.id)}>
        {r.title}
      </button>
      {!attrs.includes("description") && r.preview && <p className="v3-card-description">{r.preview}</p>}
      <div className="v3-card-tags">
      {!attrs.includes("project") && r.project_id && (
        <button
          className="v3-card-project"
          onClick={() => changes({ project: r.project_id || "" })}
        >
          <Folder size={11} />
          {value(r, "project")}
        </button>
      )}
      {!attrs.includes("labels") && r.labels.map(label => <span key={label.name}>{label.name}</span>)}
      </div>
      <footer>
        {!attrs.includes("assignee") && r.assignee_id && (
          <label className="v3-card-person">
            <i>{value(r, "assignee").slice(0, 1)}</i>
            {value(r, "assignee")}
            <select
              aria-label={r.identifier + " 负责人"}
              value={r.assignee_type + ":" + r.assignee_id}
              onChange={(e) => {
                const [type, id] = e.target.value.split(":");
                patchCard.mutate({
                  id: r.id,
                  patch: id
                    ? {
                        assignee_type: type as "member" | "squad" | "agent",
                        assignee_id: id,
                      }
                    : { assignee_id: null, assignee_type: null },
                });
              }}
            >
              {people.options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="v3-card-spacer" />
        {!attrs.includes("start_date") && r.start_date && dateField(r, "start_date", "v3-card-date")}
        {!attrs.includes("due_date") && r.due_date && dateField(r, "due_date",
          "v3-card-date" + (r.due_date < filters.today && r.status !== "done" ? " is-overdue" : ""))}
      </footer>
    </article>
  );
  const toggleRows = (items: Row[]) => {
    const ids = items.map(row => row.id);
    setSelection(previous => ids.every(id => previous.includes(id))
      ? previous.filter(id => !ids.includes(id)) : [...new Set([...previous, ...ids])]);
  };
  const groupHeader = (id: string, label: string, items: Row[], add?: () => void, status?: string) => (
    <header className="v3-group-heading">
      <input type="checkbox" aria-label={"选择" + label + "全部任务"} disabled={!items.length}
        checked={!!items.length && items.every(row => selection.includes(row.id))} onChange={() => toggleRows(items)} />
      <button aria-expanded={!folded.includes(id)} onClick={() => setFolded(previous => previous.includes(id)
        ? previous.filter(key => key !== id) : [...previous, id])}><ChevronDown size={14} />
        {status ? <BoardStatusMark status={status}/> : id.includes(":assignee:") ? <i className="v3-table-avatar">{label === "未分配" ? "?" : label.slice(0,1)}</i> : <Folder size={14}/>}
        <strong>{label}</strong><small>{items.length}</small></button>
      {add && <button aria-label={"在" + label + "中新建任务"} onClick={add}><Plus size={15} /></button>}
    </header>
  );
  const dropOn = (event: React.DragEvent, patch: UpdateIssueRequest) => {
    event.preventDefault();
    const row = rows.find(row => row.id === event.dataTransfer.getData("text/plain"));
    if (row) patchCard.mutate({ id: row.id, patch });
  };
  function openSavedView(id:string,route:string){
    const next=new URLSearchParams(route);
    next.set("view","tasks");
    next.set("saved",id);
    next.delete("directory");
    setParams(next);
    setViewDialog(false);
  }
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.altKey || event.metaKey || event.ctrlKey ||
          (event.target as HTMLElement).closest("input,textarea,select,[contenteditable=true],[role=dialog]") ||
          document.querySelector("[role=dialog]")) return;
      if (searchInput.current) { event.preventDefault(); searchInput.current.focus(); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const searchBox = <label className={mine ? "v3-mine-search" : "pd-search"}>
    <Search size={15}/><input ref={searchInput} aria-label="搜索任务" value={search}
      placeholder={mine ? "搜索任务…" : "搜索任务标题或编号…"} onChange={e => changes({q:e.target.value})}/>
    {search ? <button aria-label="清除任务搜索" onClick={() => changes({q:""})}><X size={13}/></button>
      : !mine && <kbd aria-hidden="true">/</kbd>}
  </label>;
  const viewEditor = viewDialog && (
        <Modal title="全部视图" onClose={() => setViewDialog(false)}>
          {existingViews.data
            ?.filter((v) => typeof v.query.route === "string")
            .map((v) => (
              <Action
                key={v.id}
                onClick={() => openSavedView(v.id,String(v.query.route))}
              >
                {v.name}
              </Action>
            ))}
          <Field label="新建视图">
            <Input
              placeholder="视图名称"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
            />
          </Field>
          <Failure error={saveView.error || existingViews.error} />
          <Action
            disabled={!viewName.trim() || saveView.isPending}
            onClick={() => saveView.mutate(!!activeView)}
          >
            保存当前设置
          </Action>
          {activeView && (
            <>
              <Action
                disabled={!viewName.trim()}
                onClick={() => saveView.mutate(false)}
              >
                复制为新视图
              </Action>
              <Action onClick={() => setRemovingView(true)}>删除视图</Action>
            </>
          )}
          {removingView && activeView && (
            <Modal title="删除视图" onClose={() => setRemovingView(false)}>
              <p>删除「{activeView.name}」？</p>
              <Action onClick={() => setRemovingView(false)}>取消</Action>
              <Action onClick={() => dropView.mutate()}>确认删除</Action>
              <Failure error={dropView.error} />
            </Modal>
          )}
        </Modal>
      );
  if(params.get("directory")==="1") {
    const views=[
      {id:"mine",name:"我的任务",route:"scope=mine"},
      {id:"agents",name:"我的智能体在做",route:"scope=mine&relation=my_agents"},
      {id:"all",name:"全部任务",route:""},
      ...(existingViews.data || []).filter(view=>typeof view.query.route==="string")
        .map(view=>({id:view.id,name:view.name,route:String(view.query.route)})),
    ];
    const show = (view:typeof views[number]) => {
      if (["mine","agents","all"].includes(view.id)) setParams(new URLSearchParams("view=tasks&"+view.route));
      else openSavedView(view.id,view.route);
    };
    const create=()=>{setViewName("");setViewDialog(true)};
    return <section className="v3-view-directory">
      <header><h1><Layers size={16}/>全部视图</h1><Action primary onClick={create}><Plus size={16}/>新建视图</Action></header>
      <div className="v3-view-rows">{views.map(view=><article key={view.id}><Layers size={18}/>
        <button aria-label={view.name} onClick={()=>show(view)}><strong>{view.name}</strong>
          <small>{facets.filter(key=>new URLSearchParams(view.route).has(key)).length} 项筛选</small></button>
        <button aria-label={"打开视图 "+view.name} onClick={()=>show(view)}><ChevronRight size={15}/></button>
      </article>)}</div><Failure error={existingViews.error} retry={()=>void existingViews.refetch()}/>{viewEditor}
    </section>;
  }
  return (
    <section className="v3-tasks">
      <header>
        {mine ? (
          <div className="v3-mine-heading"><ListTodo size={16}/><select
            aria-label="当前视图"
            value={relation}
            onChange={e => {
              const next = e.target.value;
              if (next === "views") setParams({view:"tasks",directory:"1"});
              else if (next === "projects") setParams({view:"projects"});
              else if (next.startsWith("project:")) setParams({view:"projects",project:next.slice(8)});
              else if (next.startsWith("saved:")) {
                const saved = existingViews.data?.find(v => v.id === next.slice(6));
                if (saved) openSavedView(saved.id,String(saved.query.route));
              } else changes(next === "all" ? {scope:"",relation:""} : {relation:next});
            }}
          >
            <option value="assigned">我的任务</option>
            <option value="my_agents">我的智能体在做</option>
            <option value="all">全部任务</option>
            {existingViews.data?.filter(v=>typeof v.query.route==="string").map(v=><option key={v.id} value={"saved:"+v.id}>{v.name}</option>)}
            {projects.data?.projects.map(p=><option key={p.id} value={"project:"+p.id}>{p.title}</option>)}
            <option value="views">全部视图</option><option value="projects">全部项目</option>
          </select><button aria-label="筛选" title="筛选" aria-expanded={filtersOpen}
            onClick={()=>setFiltersOpen(!filtersOpen)}><ListFilter size={14}/></button></div>
        ) : (
          <h1>
            <ClipboardCheck size={17} />
            {activeView?.name || "全部任务"}
          </h1>
        )}
        <div>
          {mine && searchBox}
          <Action
            data-task-display=""
            aria-expanded={display}
            aria-label="显示"
            title="显示"
            onClick={() => setDisplay(!display)}
          >
            <DisplayIcon size={16} />
          </Action>
          <Action primary onClick={() => onCreate()}>
            <Plus size={16} />
            新建任务
          </Action>
        </div>
      </header>
      {display && (
        <div className="v3-display-options" data-task-display="" role="dialog" aria-label="显示选项">
          <div className="v3-layouts" role="group" aria-label="视图类型">
            {layouts.map(([id, title, Icon]) => (
              <button type="button"
                key={id}
                aria-pressed={layout === id}
                onClick={() => {
                  changes({ layout: id });
                }}
              >
                <Icon size={19}/>
                {title}
              </button>
            ))}
          </div>
          <div className="v3-display-fields">
            {layout === "board" && <label>分组<Picker label="分组" value={grouping} onChange={group=>changes({group})}
              options={pairs([["status","状态"],["assignee","负责人"],["priority","优先级"],["project","项目"]])}/></label>}
            {(layout === "table" || layout === "swimlane") && <label>分组<Picker
              label={layout === "table" ? "表格分组" : "泳道分组"} value={layout === "table" ? tableGroup : laneGroup}
              onChange={value=>changes({[layout === "table" ? "table_group" : "lane_group"]:value})}
              options={pairs([...(layout === "table" ? [["none","无分组"],["status","状态"]] : []),["assignee","负责人"],["project","项目"]])}/></label>}
            <label>排序<span className="v3-display-sort">
              <button aria-label="切换排序方向" title={direction === "asc" ? "升序" : "降序"} onClick={()=>changes({direction:direction === "asc" ? "desc" : "asc"})}><ArrowUpDown size={16}/></button>
              <Picker label="显示排序" value={sort} onChange={field=>changes({sort:field,direction:["created_at","updated_at"].includes(field)?"desc":"asc"})}
                options={pairs([["position","手动排序"],["created_at","创建时间"],["updated_at","更新时间"],["priority","优先级"],["due_date","截止日期"],["title","标题"],
                  ...columns.filter(([key])=>key===sort && !["priority","due_date","title"].includes(key)).map(([key,title])=>[key,title])])}/>
            </span></label>
          </div>
          {layout !== "table" && <section><h3>{layout === "board" ? "看板选项" : layout === "list" ? "列表选项" : "泳道选项"}</h3>
            <h4>列</h4><div className="v3-display-chips">{statuses.options.map(option =>
              <button key={option.value} aria-pressed={!hidden.includes(option.value)} onClick={() =>
                setHidden(hidden.includes(option.value) ? hidden.filter(key => key !== option.value) : [...hidden, option.value])}>
                <BoardStatusMark status={option.value}/>{option.label}
              </button>)}</div></section>}
          <section><h3>{layout === "table" ? "显示列" : "卡片属性"}</h3>
            <div className="v3-display-chips">{(layout === "table" ? tableColumns.slice(1) : cardProperties).map(([key, title]) => {
              const excluded = layout === "table" ? hiddenColumns : attrs;
              const enabled = !excluded.includes(key);
              const next = enabled ? [...excluded, key] : excluded.filter(item => item !== key);
              return <button key={key} aria-pressed={enabled} onClick={() =>
                changes({ ...(layout !== "table" ? { column_hidden: hiddenColumns.length ? hiddenColumns : ["none"] } : {}),
                  [layout === "table" ? "column_hidden" : "attr"]: next.length ? next : ["none"] })}>{title}</button>;
            })}</div>
          </section>
          <footer><button
            onClick={() =>
              changes({
                group: "",
                attr: [],
                column_hidden: [],
                table_group: "", lane_group: "",
                hidden: [],
                direction: "",
                sort: "",
              })
            }
          >
            恢复默认显示
          </button>
          {(activeView || [...params.keys()].some(key=>!["view","scope","saved","layout"].includes(key)) || layout!=="board") &&
            <button onClick={()=>{setViewName(activeView?.name || "");setDisplay(false);setViewDialog(true);}}>{activeView?"管理自定义视图":"保存为视图"}</button>}
          </footer>
        </div>
      )}
      {(!mine || filtersOpen) && (
        <div className="v3-board-filters">
          {!mine && searchBox}
          {[1, 2, 3, 0, 4, 5].map(i => (
            <MultiFilter
              key={facets[i]}
              label={
                ["项目", "状态", "负责人", "优先级", "截止日期", "标签"][i]
              }
              options={filterOptions[i]}
              values={keyValues(facets[i])}
              onChange={(v) => changes({ [facets[i]]: v })}
            />
          ))}
          {
            <Action className="v3-clear-filters"
              disabled={!search && !facets.some((k) => keyValues(k).length)}
              onClick={() =>
                changes(
                  Object.fromEntries(["q", ...facets].map((k) => [k, ""])),
                )
              }
            >
              清除全部
            </Action>
          }
        </div>
      )}
      <Failure
        error={
          issues.error ||
          projects.error ||
          labels.error ||
          patchCard.error ||
          reorder.error ||
          bulk.error ||
          bulkOwner.error ||
          pins.error || rowAction.error || exported.error
        }
      />
      {selection.length > 0 && (
        <div className="v3-layouts" role="group" aria-label="视图类型">
          已选择 {selection.length} 项
          <select
            aria-label="批量设置状态"
            value=""
            onChange={(e) => bulk.mutate(e.target.value)}
          >
            <option value="">设置状态</option>
            {statuses.options.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            aria-label="批量设置负责人"
            value=""
            onChange={(e) => bulkOwner.mutate(e.target.value)}
          >
            <option value="">设置负责人</option>
            {people.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Action onClick={() => setDeleteMode(true)}>删除</Action>
          <Action onClick={() => setSelection([])}>取消选择</Action>
        </div>
      )}
      {removeTarget && <Modal title="删除任务" onClose={() => setRemoveTarget(null)}>
        <p>删除「{removeTarget.title}」？</p><Action onClick={() => setRemoveTarget(null)}>取消</Action>
        <Action disabled={rowAction.isPending} onClick={() => rowAction.mutate({id:removeTarget.id,action:"delete"})}>确认删除</Action>
        <Failure error={rowAction.error}/>
      </Modal>}
      {!visibleStatuses.length && (layout === "list" || layout === "swimlane" || layout === "board" && grouping === "status") ? (
        <p className="v3-no-tasks">没有可显示的状态列，请在显示菜单中开启。</p>
      ) : layout === "table" ? (
        <div className="v3-table-wrap">
          <div className="v3-table-tools"><button aria-label="导出 CSV" onClick={() => exported.mutate()}><Download size={15} />导出</button></div>
          <table aria-label="任务表格">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="选择本页"
                    checked={
                      !!rows.length &&
                      rows.every((row) => selection.includes(row.id))
                    }
                    onChange={(e) =>
                      setSelection(
                        e.target.checked
                          ? [
                              ...new Set([
                                ...selection,
                                ...rows.map((r) => r.id),
                              ]),
                            ]
                          : selection.filter(
                              (id) => !rows.some((row) => row.id === id),
                            ),
                      )
                    }
                  />
                </th>
                {shownColumns.map(([col, label]) => col === "labels" ? <th key={col} data-column={col}>{label}</th> : (
                  <th
                    key={col}
                    data-column={col}
                    aria-sort={
                      sort === col
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      onClick={() =>
                        changes({
                          sort: col,
                          direction:
                            sort === col && direction === "asc"
                              ? "desc"
                              : "asc",
                        })
                      }
                    >
                      {label}
                      <ArrowUpDown size={12} />
                    </button>
                  </th>
                ))}
                <th aria-label="任务操作" className="v3-row-actions-cell"/>
              </tr>
            </thead>
            {tableGroups.map(group => <tbody key={group.value}>
              {tableGroup !== "none" && <tr className="v3-table-group"><td colSpan={shownColumns.length + 2}>
                {groupHeader("table:"+tableGroup+":"+group.value, group.label, group.items)}</td></tr>}
              {!folded.includes("table:"+tableGroup+":"+group.value) && group.items.map((r) => (
                <tr key={r.id} data-task-id={r.id} onClick={event => openRow(event, r.id)}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={"选择" + r.title}
                      checked={selection.includes(r.id)}
                      onChange={(e) =>
                        setSelection(
                          e.target.checked
                            ? [...selection, r.id]
                            : selection.filter((id) => id !== r.id),
                        )
                      }
                    />
                  </td>
                  {shownColumns.map(([col, label]) => (
                    <td key={col} data-column={col}>
                      {col === "title" ? (
                        <div className="v3-table-title"><small>{r.identifier}</small>
                          <button onClick={() => open(r.id)}>{r.title}</button></div>
                      ) : (
                        col === "labels" ? <TaskTableLabels id={r.id} identifier={r.identifier} revision={r.revision} names={(r.labels || []).map(l => l.name)} /> : tableField(r, col, label)
                      )}
                    </td>
                  ))}
                  <td className="v3-row-actions-cell">{rowMenu(r)}</td>
                </tr>
              ))}
            </tbody>)}
          </table>
        </div>
      ) : layout === "list" ? (
        <div className="v3-task-list" aria-label="任务列表">{groupedRows("status", visibleStatuses).map(group =>
          <section key={group.value} onDragOver={event => event.preventDefault()}
            onDrop={event => dropOn(event, {status:group.value})}>
            {groupHeader("list:"+group.value, group.label, group.items, () => createInColumn(group.value, "status"), group.value)}
            {!folded.includes("list:"+group.value) && (group.items.length ? group.items.map(row =>
              <div className="v3-list-row" key={row.id} data-task-id={row.id} draggable
                onDragStart={event => event.dataTransfer.setData("text/plain",row.id)}>
                <input type="checkbox" checked={selection.includes(row.id)} aria-label={"选择"+row.title}
                  onChange={() => toggleRows([row])} />
                <small>{row.identifier}</small><button className="v3-list-title" onClick={() => open(row.id)}>{row.title}{!attrs.includes("description") && row.preview && <small>{row.preview}</small>}</button>
                {!attrs.includes("labels") && row.labels.map(l => <span className="v3-list-label" key={l.name}>{l.name}</span>)}
                {columns.map(([key,label]) => key !== "title" && key !== "status" && !attrs.includes(key) &&
                  (key === "priority" ? row.priority !== "none" : key === "project" ? !!row.project_id :
                   key === "assignee" ? !!row.assignee_id : !!row[key]) && <Fragment key={key}>{tableField(row,key,label)}</Fragment>)}
                {rowMenu(row)}
              </div>) : <p className="v3-no-tasks">无任务</p>)}
          </section>)}</div>
      ) : layout === "swimlane" ? (
        <div className="v3-swimlanes" aria-label="任务泳道"><div className="v3-swim-status">
          {visibleStatuses.map(s => <div key={s.value}><BoardStatusMark status={s.value}/><strong>{s.label}</strong><small>{rows.filter(row => row.status===s.value).length}</small>
            <button aria-label={"添加"+s.label+"任务"} onClick={() => createInColumn(s.value,"status")}><Plus size={15} /></button></div>)}
        </div>{lanes.map(lane => <section key={lane.value}>
          {groupHeader("lane:"+laneGroup+":"+lane.value,lane.label,lane.items,() => createInColumn(lane.value,laneGroup))}
          {!folded.includes("lane:"+laneGroup+":"+lane.value) && <div className="v3-swim-grid">{visibleStatuses.map(s => {
            const items = lane.items.filter(row => row.status === s.value);
            return <div key={s.value} data-status={s.value} data-lane={lane.value} className="v3-swim-cell"
              onDragOver={event => { event.preventDefault(); event.currentTarget.classList.add("is-over"); }}
              onDragLeave={event => { if(!event.currentTarget.contains(event.relatedTarget as Node)) event.currentTarget.classList.remove("is-over"); }}
              onDrop={event => { event.currentTarget.classList.remove("is-over"); dropOn(event, {...groupPatch(laneGroup,lane.value),status:s.value}); }}>
              {items.map(card)}{!items.length && <p>—</p>}
              <button aria-label={"在"+lane.label+"的"+s.label+"中新建任务"} onClick={() => createInColumn(lane.value,laneGroup,s.value)}><Plus size={16} /></button>
            </div>;
          })}</div>}
        </section>)}</div>
      ) : (
        <div className="v3-columns">
          {groups.map((s) => (
            <section
              key={s.value}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const row = rows.find((r) => r.id === id);
                if (!row) return;
                if (groupValue(row) !== s.value)
                  patchCard.mutate({ id, patch: groupPatch(grouping, s.value) });
                else
                  reorder.mutate({
                    id,
                    target: s.value,
                    before:
                      (e.target as HTMLElement).closest<HTMLElement>(
                        "[data-task-id]",
                      )?.dataset.taskId ?? null,
                  });
              }}
            >
              <h3>
                {grouping === "status" ? <Status value={s.value} /> : s.label}
                <small>
                  {rows.filter((r) => groupValue(r) === s.value).length}
                </small>
                <button
                  aria-label={s.label + "列菜单"}
                  aria-expanded={columnMenu === s.value}
                  onClick={() =>
                    setColumnMenu(columnMenu === s.value ? "" : s.value)
                  }
                >
                  ···
                </button>
                <button
                  className="v3-column-add"
                  aria-label={"添加" + s.label + "任务"}
                  onClick={() => createInColumn(s.value)}
                >
                  <Plus size={13} />
                </button>
              </h3>
              {columnMenu === s.value && (
                <div className="v3-column-menu">
                  <Action onClick={() => createInColumn(s.value)}>
                    添加任务
                  </Action>
                  <Action
                    onClick={() => {
                      setColumnMenu("");
                      setSelection(
                        rows
                          .filter((r) => groupValue(r) === s.value)
                          .map((r) => r.id),
                      );
                    }}
                  >
                    选择列内任务
                  </Action>
                  {grouping === "status" && (
                    <Action
                      onClick={() => {
                        setColumnMenu("");
                        setHidden([...hidden, s.value]);
                      }}
                    >
                      隐藏状态列
                    </Action>
                  )}
                </div>
              )}
              {rows.filter((r) => groupValue(r) === s.value).map(card)}
              {!rows.some((r) => groupValue(r) === s.value) && (
                <p className="v3-no-tasks">无任务</p>
              )}
            </section>
          ))}
        </div>
      )}
      {!issues.isPending && !issues.error && !rows.length && (
        <Empty>没有匹配的任务</Empty>
      )}
      {(cursor || issues.data?.next_cursor) && (
        <footer>
          <Action disabled={!cursor} onClick={() => changePage(null, true)}>
            上一页
          </Action>
          <Action
            disabled={!issues.data?.next_cursor}
            onClick={() => changePage(issues.data?.next_cursor || null)}
          >
            下一页
          </Action>
        </footer>
      )}
      {deleteMode && (
        <Modal title="删除所选任务" onClose={() => setDeleteMode(false)}>
          <p>确认删除 {selection.length} 项任务？</p>
          <Action onClick={() => setDeleteMode(false)}>取消</Action>
          <Action
            disabled={bulk.isPending}
            onClick={() => bulk.mutate("delete")}
          >
            删除
          </Action>
        </Modal>
      )}
      {viewEditor}
    </section>
  );
}
