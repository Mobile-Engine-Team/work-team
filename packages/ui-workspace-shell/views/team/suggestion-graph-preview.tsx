import type {
  BlueprintGraph,
  PlanningRequest,
} from "@multica/core/types/project-blueprint";
import { layoutGraph } from "./blueprint-model";
import { text } from "./client";
export function SuggestionGraphPreview({
  graph,
  changes,
}: {
  graph: BlueprintGraph;
  changes: NonNullable<PlanningRequest["result"]>["changes"];
}) {
  const laid = layoutGraph(graph),
    width = Math.max(400, ...laid.nodes.map((n) => n.position.x + 290)),
    height = Math.max(120, ...laid.nodes.map((n) => n.position.y + 100));
  return (
    <section>
      <h4>{text("project.selectedChangesPreview")}</h4>
      <div className="project-suggestion-graph">
        <svg
          role="img"
          aria-label={text("project.selectedChangesPreview")}
          viewBox={`0 0 ${width} ${height}`}
        >
          {laid.edges.map((e) => {
            const from = laid.nodes.find((n) => n.id === e.from),
              to = laid.nodes.find((n) => n.id === e.to);
            return from && to ? (
              <path
                key={e.id}
                d={`M${from.position.x + 260},${from.position.y + 36} L${to.position.x},${to.position.y + 36}`}
                fill="none"
                stroke="var(--mw-brand)"
                strokeWidth="2"
              >
                <title>{`${from.title} → ${to.title}: ${e.handoff}`}</title>
              </path>
            ) : null;
          })}
          {laid.nodes.map((n) => {
            const c = changes.find(
              (c) => c.target === n.id || c.node?.id === n.id,
            );
            return (
              <g
                key={n.id}
                transform={`translate(${n.position.x},${n.position.y})`}
              >
                <rect
                  width="260"
                  height="72"
                  rx="8"
                  fill="var(--mw-surface-bg, var(--mw-gray-1))"
                  stroke={c ? "var(--mw-brand)" : "var(--mw-divider)"}
                  strokeWidth={c ? 3 : 1}
                />
                <text x="12" y="28" fill="currentColor">
                  {n.title.slice(0, 18)}
                </text>
                <text x="12" y="52" fill="currentColor" fontSize="12">
                  {c ? text(`project.suggestion.${c.kind}`) : ""}
                </text>
                <title>{n.title + "\n" + (c?.reason || n.requirements)}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
