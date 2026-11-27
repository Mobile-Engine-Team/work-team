import type { BlueprintGraph } from "./project-blueprint-store";
import { text } from "./project-reference-ui";
export function ProjectChangeDetails({
  before,
  after,
  id,
  name,
}: {
  before: BlueprintGraph;
  after: BlueprintGraph;
  id: string;
  name: (id: string | null) => string;
}) {
  const old = before.nodes.find((n) => n.id === id),
    next = after.nodes.find((n) => n.id === id);
  if (!id || id === "edges") {
    const label = (
      graph: BlueprintGraph,
      edge: BlueprintGraph["edges"][number],
    ) =>
      `${graph.nodes.find((n) => n.id === edge.from)?.title || "?"} → ${graph.nodes.find((n) => n.id === edge.to)?.title || "?"}${edge.handoff ? ` · ${edge.handoff}` : ""}`;
    return (
      <div className="project-field-diff">
        {before.edges
          .filter(
            (e) =>
              !after.edges.some(
                (n) => n.id === e.id && JSON.stringify(n) === JSON.stringify(e),
              ),
          )
          .map((e) => (
            <del key={e.id}>{label(before, e)}</del>
          ))}
        {after.edges
          .filter(
            (e) =>
              !before.edges.some(
                (n) => n.id === e.id && JSON.stringify(n) === JSON.stringify(e),
              ),
          )
          .map((e) => (
            <ins key={e.id}>{label(after, e)}</ins>
          ))}
      </div>
    );
  }
  const fields = [
    { key: "title", label: "title" },
    { key: "requirements", label: "requirements" },
    { key: "assignee_id", label: "assignee" },
    { key: "due_date", label: "dueDate" },
  ] as const;
  return (
    <div className="project-field-diff">
      {fields.map((f) => {
        const a = old?.[f.key] || "",
          b = next?.[f.key] || "";
        if (a === b) return null;
        const value = (v: string) =>
          f.key === "assignee_id" ? name(v || null) : v || "—";
        return (
          <div key={f.key}>
            <small>{text(`project.${f.label}`)}</small>
            {old && <del>{value(a)}</del>}
            {next && <ins>{value(b)}</ins>}
          </div>
        );
      })}
    </div>
  );
}
