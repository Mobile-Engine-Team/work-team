import type { AgentRuntime, AgentTask } from "@multica/core/types";
import { isActiveRun } from "./relations";

// Availability qualifies execution only; it never rewrites the issue lifecycle.
export function executionState(
  run: AgentTask,
  runtimes: readonly Pick<AgentRuntime, "id" | "status">[] | undefined,
) {
  if (!isActiveRun(run)) return run.status;
  const runtime = runtimes?.find((r) => r.id === run.runtime_id);
  if (!runtime) return run.status;
  if (runtime.status === "offline") return "offline";
  return run.status;
}
export function executionLabel(state: ReturnType<typeof executionState>) {
  if (state === "offline") return "agentOffline";
  if (state === "running") return "agentRunning";
  if (state === "queued" || state === "dispatched") return "agentQueued";
  return `status.${state}`;
}
