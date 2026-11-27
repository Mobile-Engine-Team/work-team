import { text, teamApi, useTeamQuery } from "./client";

// Presentation of native activity/inbox details; no inferred lifecycle changes.
export function EventSummary({
  action,
  details = {},
  name,
  waiting = false,
}: {
  action: string;
  details?: Record<string, unknown>;
  name?: (id: string | null) => string;
  waiting?: boolean;
}) {
  const statuses = useTeamQuery(["statuses"], () =>
    teamApi.listIssueStatuses(),
  );
  const value = (key: string) =>
    typeof details[key] === "string" ? details[key] : "";
  const status = (key: string) => {
    const raw = value(key);
    const translated = text(`status.${raw}`);
    return translated.startsWith("team.")
      ? statuses.data?.statuses.find((s) => s.key === raw)?.name || raw
      : translated;
  };
  const translated = text(`activity.${action}`);
  let summary = translated.startsWith("team.")
    ? `${text("activity.event")} · ${action}`
    : translated;
  if (action === "squad_leader_evaluated") {
    const outcome = value("outcome");
    const label = text(`squadOutcome.${outcome}`);
    return (
      <span className="team-squad-evaluation">
        <strong>
          {name?.(value("squad_id")) || text("mentionSquad")} ·{" "}
          {label.startsWith("team.") ? text("squadOutcome.unknown") : label}
        </strong>
        <span>
          {text(
            `squadOutcomeHint.${["action", "no_action", "failed"].includes(outcome) ? outcome : "unknown"}`,
          )}
        </span>
        {outcome === "no_action" && waiting && <span>{text("squadWaitingAtEvaluation")}</span>}
        {value("reason") && (
          <details className="team-evaluation-details">
            <summary>{text("originalCoordinationReason")}</summary>
            <p>{value("reason")}</p>
          </details>
        )}
      </span>
    );
  }
  if (action === "status_changed")
    summary = `${text("state")}: ${status("from") || "?"} → ${status("to") || "?"}`;
  else if (
    [
      "priority_changed",
      "title_changed",
      "due_date_changed",
      "start_date_changed",
    ].includes(action)
  )
    summary += `: ${value("from") || "—"} → ${value("to") || "—"}`;
  else if (action === "assignee_changed")
    summary += `: ${name?.(value("to_id") || value("new_assignee_id") || null) || text("unassigned")}`;
  return <span>{summary}</span>;
}
