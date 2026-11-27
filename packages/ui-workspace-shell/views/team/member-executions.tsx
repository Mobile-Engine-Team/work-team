import { useState } from "react";
import type { AgentTask, TimelineEntry } from "@multica/core/types";
import { text } from "./client";
import { isActiveRun, locate } from "./relations";
import { executionGroups } from "./timeline-presentation";
import { Progress } from "./progress";

export function MemberExecutions({
  entry,
  runs,
  name,
}: {
  entry: TimelineEntry;
  runs: AgentTask[];
  name: (id: string | null) => string;
}) {
  const { members, source } = executionGroups(entry, runs);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [wasOpen, setWasOpen] = useState(false);
  const needsAttention = members.some(
    (r) => isActiveRun(r) || r.status === "failed",
  );
  // Keep an automatically opened live group open when its last run finishes.
  if (needsAttention && !wasOpen) setWasOpen(true);
  const open = expanded ?? (needsAttention || wasOpen);
  const counts = new Map<string, number>();
  for (const run of members)
    counts.set(run.status, (counts.get(run.status) || 0) + 1);
  const rows = members.map((run) => (
    <div className="team-member-execution" key={run.id}>
      <span>{name(run.agent_id)}</span>
      <Progress active={isActiveRun(run)}>
        {text(`status.${run.status}`)}
      </Progress>
      <button
        className="team-text-action"
        onClick={() => locate(`run-${run.id}`)}
      >
        {text("viewExecution")}
      </button>
    </div>
  ));
  return (
    <>
      {members.length === 1 ? (
        <div
          className="team-member-execution-single"
          aria-label={text("memberExecutions")}
        >
          {rows}
        </div>
      ) : members.length > 1 ? (
        <details className="team-member-executions" open={open}>
          <summary
            onClick={(event) => {
              event.preventDefault();
              setExpanded(!open);
            }}
          >
            {text("memberExecutions")} · {members.length} ·{" "}
            {[...counts]
              .map(([status, count]) => `${text(`status.${status}`)} ${count}`)
              .join(" / ")}
          </summary>
          {rows}
        </details>
      ) : null}
      {source && (
        <div className="team-execution-source">
          {text("replyExecutionSource")} · {name(source.agent_id)} ·{" "}
          {text(`status.${source.status}`)}
          <button
            className="team-text-action"
            onClick={() => locate(`run-${source.id}`)}
          >
            {text("viewExecution")}
          </button>
        </div>
      )}
    </>
  );
}
