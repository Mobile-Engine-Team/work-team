import type { AgentTask, TimelineEntry } from "@multica/core/types";
import { commentSupplementReceipts } from "@multica/core/issues/run-steering";

export const isActiveRun = (run: AgentTask) =>
  !["completed", "failed", "cancelled"].includes(run.status);

// Claim receipts take precedence over the queued coverage plan, including [].
export function runInputIds(run: AgentTask): string[] {
  const planned = [
    run.trigger_comment_id,
    ...(run.coalesced_comment_ids ?? []),
  ].filter((id): id is string => !!id);
  return [
    ...new Set([
      ...(run.status === "queued" || run.status === "deferred"
        ? planned
        : (run.delivered_comment_ids ?? planned)),
      ...(run.supplement_comment_ids ?? []),
    ]),
  ];
}

export function relatedRuns(
  entry: TimelineEntry,
  runs: AgentTask[],
): AgentTask[] {
  const receipts = commentSupplementReceipts(entry);
  return runs.filter(
    (run) =>
      entry.source_task_id === run.id ||
      runInputIds(run).includes(entry.id) ||
      receipts.some((receipt) => receipt.task_id === run.id) ||
      (entry.type === "activity" && entry.details?.task_id === run.id),
  );
}

export function excerpt(entry: TimelineEntry): string {
  if (entry.deleted_at) return "";
  return (entry.content ?? "")
    .replace(/\[([^\]]+)\]\(mention:\/\/[^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

// Open containing history, then focus the actual referenced item. No time joins.
export function locate(id: string): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  for (
    let parent = target.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  document
    .querySelectorAll(".team-located")
    .forEach((node) => node.classList.remove("team-located"));
  // Restart the same theme-only cue on repeated navigation.
  void target.offsetWidth;
  target.classList.add("team-located");
  target.tabIndex = -1;
  target.scrollIntoView({
    block: "center",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
  target.focus({ preventScroll: true });
  target.addEventListener(
    "animationend",
    () => target.classList.remove("team-located"),
    { once: true },
  );
  return true;
}

// Human provenance is authoritative; owning the agent does not mean initiating its run.
export function personalRuns(
  runs: readonly AgentTask[],
  userId: string,
): AgentTask[] {
  return runs.filter(
    (run) =>
      run.attribution?.precise && run.attribution.initiator?.id === userId,
  );
}

export function sharedTimeline(
  entries: TimelineEntry[],
  runs: AgentTask[],
): TimelineEntry[] {
  const ownIds = new Set(runs.map((run) => run.id));
  return entries.filter(
    (entry) =>
      entry.type !== "activity" ||
      !entry.action?.startsWith("task_") ||
      (typeof entry.details?.task_id === "string" &&
        ownIds.has(entry.details.task_id)),
  );
}

// Only a native evaluation's exact task reference identifies a squad turn.
export function latestSquadFeedback(
  entries: readonly TimelineEntry[],
): TimelineEntry | undefined {
  const leaderTasks = new Set(
    entries
      .filter(
        (e) =>
          e.type === "activity" &&
          e.action === "squad_leader_evaluated" &&
          typeof e.details?.task_id === "string",
      )
      .map((e) => e.details!.task_id),
  );
  return entries
    .filter(
      (e) =>
        e.type === "comment" &&
        e.actor_type === "agent" &&
        !e.deleted_at &&
        e.source_task_id &&
        leaderTasks.has(e.source_task_id) &&
        e.content?.trim(),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}
