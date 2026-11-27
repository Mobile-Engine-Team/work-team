import {
  blueprintGraphSchema,
  type BlueprintGraph,
  type BlueprintNode,
} from "@multica/core/types/project-blueprint";

export const emptyGraph = (): BlueprintGraph => ({
  schema_version: 1,
  nodes: [],
  edges: [],
});
export const newNode = (title: string): BlueprintNode => ({
  id: crypto.randomUUID(),
  issue_id: "",
  title,
  requirements: "",
  assignee_type: "",
  assignee_id: "",
  due_date: "",
  position: { x: 80, y: 80 },
});
export function graphEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export type MergeConflict = { path: string; local: unknown; remote: unknown };
export function mergeGraphs(
  base: BlueprintGraph,
  local: BlueprintGraph,
  remote: BlueprintGraph,
  choices: Record<string, "local" | "remote"> = {},
) {
  const conflicts: MergeConflict[] = [];
  function merge(b: unknown, l: unknown, r: unknown, path: string): unknown {
    if (graphEqual(l, b)) return r;
    if (graphEqual(r, b) || graphEqual(l, r)) return l;
    if (path.endsWith(".position") || path.endsWith(".baseline")) return r;
    if (record(b) && record(l) && record(r)) {
      const out: Record<string, unknown> = {};
      for (const key of new Set([
        ...Object.keys(b),
        ...Object.keys(l),
        ...Object.keys(r),
      ]))
        out[key] = merge(b[key], l[key], r[key], `${path}.${key}`);
      return out;
    }
    if (choices[path]) return choices[path] === "local" ? l : r;
    conflicts.push({ path, local: l, remote: r });
    return r;
  }
  function entities<T extends { id: string }>(
    b: T[],
    l: T[],
    r: T[],
    prefix: string,
  ): unknown[] {
    const bm = new Map(b.map((v) => [v.id, v])),
      lm = new Map(l.map((v) => [v.id, v])),
      rm = new Map(r.map((v) => [v.id, v]));
    return [...new Set([...rm.keys(), ...lm.keys()])]
      .map((id) => merge(bm.get(id), lm.get(id), rm.get(id), `${prefix}.${id}`))
      .filter((v) => v !== undefined);
  }
  const graph = blueprintGraphSchema.parse({
    schema_version: 1,
    nodes: entities(base.nodes, local.nodes, remote.nodes, "nodes"),
    edges: entities(base.edges, local.edges, remote.edges, "edges"),
  });
  return { graph, conflicts };
}
export function validEdge(graph: BlueprintGraph, from: string, to: string) {
  if (
    !from ||
    !to ||
    from === to ||
    graph.edges.some((e) => e.from === from && e.to === to)
  )
    return false;
  const seen = new Set<string>();
  function reaches(id: string): boolean {
    if (id === from) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return graph.edges.filter((e) => e.from === id).some((e) => reaches(e.to));
  }
  return !reaches(to);
}
export function layoutGraph(graph: BlueprintGraph): BlueprintGraph {
  const neighbors = new Map(graph.nodes.map((n) => [n.id, new Set<string>()]));
  for (const e of graph.edges) {
    neighbors.get(e.from)?.add(e.to);
    neighbors.get(e.to)?.add(e.from);
  }
  const visited = new Set<string>(),
    positions = new Map<string, { x: number; y: number }>();
  let shelfX = 60,
    shelfY = 60,
    shelfHeight = 0;
  for (const root of graph.nodes) {
    if (visited.has(root.id)) continue;
    const component: string[] = [],
      queue = [root.id];
    visited.add(root.id);
    for (let i = 0; i < queue.length; i++) {
      const id = queue[i];
      component.push(id);
      for (const next of neighbors.get(id) || []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    const levels = new Map(component.map((id) => [id, 0]));
    for (let i = 0; i < component.length; i++)
      for (const e of graph.edges)
        if (levels.has(e.from) && levels.has(e.to))
          levels.set(
            e.to,
            Math.max(levels.get(e.to)!, levels.get(e.from)! + 1),
          );
    const rows = new Map<number, number>(),
      local = new Map<string, { x: number; y: number }>();
    let width = 310,
      height = 170;
    for (const id of component) {
      const level = levels.get(id)!,
        row = rows.get(level) || 0;
      rows.set(level, row + 1);
      local.set(id, { x: level * 310, y: row * 170 });
      width = Math.max(width, (level + 1) * 310);
      height = Math.max(height, (row + 1) * 170);
    }
    if (shelfX > 60 && shelfX + width > 1300) {
      shelfX = 60;
      shelfY += shelfHeight + 30;
      shelfHeight = 0;
    }
    for (const [id, pos] of local)
      positions.set(id, { x: shelfX + pos.x, y: shelfY + pos.y });
    shelfX += width;
    shelfHeight = Math.max(shelfHeight, height);
  }
  return {
    ...graph,
    nodes: graph.nodes.map((n) => ({
      ...n,
      position: positions.get(n.id) || n.position,
    })),
  };
}
export function describeChanges(before: BlueprintGraph, after: BlueprintGraph) {
  const changes: {
    id: string;
    kind: "added" | "removed" | "changed" | "dependencies";
    title: string;
  }[] = [];
  for (const n of after.nodes) {
    const old = before.nodes.find((v) => v.id === n.id);
    if (!old) changes.push({ id: n.id, kind: "added", title: n.title });
    else if (
      [
        "title",
        "requirements",
        "assignee_type",
        "assignee_id",
        "due_date",
      ].some((k) => Reflect.get(old, k) !== Reflect.get(n, k))
    )
      changes.push({ id: n.id, kind: "changed", title: n.title });
  }
  for (const n of before.nodes)
    if (!after.nodes.some((v) => v.id === n.id))
      changes.push({ id: n.id, kind: "removed", title: n.title });
  if (!graphEqual(before.edges, after.edges))
    changes.push({ id: "edges", kind: "dependencies", title: "" });
  return changes;
}

// Layout and live baseline refreshes are editing metadata, not plan changes.
export function planEqual(a: BlueprintGraph, b: BlueprintGraph): boolean {
  const semantic = (g: BlueprintGraph) => ({
    nodes: g.nodes
      .map((n) => ({
        id: n.id,
        issue_id: n.issue_id,
        title: n.title,
        requirements: n.requirements,
        assignee_type: n.assignee_type,
        assignee_id: n.assignee_id,
        due_date: n.due_date,
      }))
      .sort((x, y) => x.id.localeCompare(y.id)),
    edges: g.edges
      .map((e) => ({ from: e.from, to: e.to, handoff: e.handoff }))
      .sort((x, y) => `${x.from}:${x.to}`.localeCompare(`${y.from}:${y.to}`)),
  });
  return graphEqual(semantic(a), semantic(b));
}

// Revisions increase on save, publish and reopening. A late response must not
// turn our acknowledged active draft back into its older published snapshot.
export function isNewerDraftRevision(base: {revision:number}|null, remote:{revision:number}) {
  return !base || remote.revision > base.revision;
}
