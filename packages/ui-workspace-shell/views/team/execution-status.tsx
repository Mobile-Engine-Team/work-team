import { Link } from "react-router-dom";
import type { AgentTask } from "@multica/core/types";
import { teamApi, text, useTeam, useTeamQuery } from "./client";
import { isActiveRun } from "./relations";
import { executionState, executionLabel } from "./execution-state";

export function useTeamRuntimes() {
  const { workspace } = useTeam();
  return useTeamQuery(["runtimes"], () =>
    teamApi.listRuntimes({ workspace_id: workspace.id }),
  );
}
export function ExecutionStatus({
  runs,
  hintOnly = false,
}: {
  runs: AgentTask[];
  hintOnly?: boolean;
}) {
  const runtimes = useTeamRuntimes();
  const { workspace } = useTeam();
  const states = [
    ...new Set(runs.map((run) => executionState(run, runtimes.data))),
  ];
  const offline = states.includes("offline");
  return (
    <div className="team-execution-status">
      {!hintOnly && (
        <span className="team-execution-badges">
          {states.map((state) => (
            <span key={state} className={`team-status team-status-${state}`}>
              {text(executionLabel(state))}
            </span>
          ))}
        </span>
      )}
      {hintOnly && offline && (
        <div className="team-offline-hint">
          <span>
            {text(
              runs.some((run) => run.status === "running")
                ? "offlineInterrupted"
                : "offlineWaiting",
            )}
          </span>
          <Link to={`/team/${workspace.slug}?view=settings`}>
            {text("openRuntimeSettings")}
          </Link>
        </div>
      )}
    </div>
  );
}
export function IssueExecutionStatus({ runs }: { runs: AgentTask[] }) {
  return <ExecutionStatus runs={runs.filter(isActiveRun)} />;
}
