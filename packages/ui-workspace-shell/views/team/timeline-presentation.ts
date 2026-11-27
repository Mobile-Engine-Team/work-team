import type { AgentTask, TimelineEntry } from "@multica/core/types";
import { relatedRuns } from "./relations";

export function executionGroups(entry: TimelineEntry, runs: AgentTask[]) {
  const linked = relatedRuns(entry, runs).sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
  const sourceID =
    entry.source_task_id ??
    (entry.type === "activity" ? entry.details?.task_id : undefined);
  return {
    source: linked.find((r) => r.id === sourceID),
    members: linked.filter((r) => r.id !== sourceID),
  };
}

// Legacy recovery notices have a fixed server envelope. Never classify member text.
export function isRecoveryNotice(entry: TimelineEntry) {
  return (
    entry.actor_type === "system" &&
    entry.comment_type === "progress_update" &&
    !!entry.source_task_id &&
    /^Delegated task `[0-9a-f-]+` ended in a final failure /i.test(
      entry.content || "",
    )
  );
}

export function waitingAtEvaluation(entry: TimelineEntry, runs: AgentTask[]) {
  const leader = runs.find((run) => run.id === entry.details?.task_id);
  if (!leader) return false;
  const byID = new Map(runs.map((run) => [run.id, run]));
  // Follow recorded delegation across result-triggered coordinator turns.
  const root = (run: AgentTask): string | undefined => {
    const visited = new Set<string>();
    let current: AgentTask | undefined = run;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = current.attribution?.delegated_from_task_id;
      if (!parent) return current.id;
      current = byID.get(parent);
    }
    return undefined;
  };
  const origin = root(leader);
  const evaluatedAt = Date.parse(entry.created_at);
  return (
    !!origin &&
    runs.some(
      (run) =>
        run.agent_id !== leader.agent_id &&
        root(run) === origin &&
        Date.parse(run.created_at) <= evaluatedAt &&
        (!run.completed_at || Date.parse(run.completed_at) > evaluatedAt),
    )
  );
}
