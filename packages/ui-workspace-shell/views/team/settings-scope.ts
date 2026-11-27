import { isRuntimeUsableForUser } from "@multica/core/runtimes/access";
import type { Agent, AgentRuntime } from "@multica/core/types";
import {
  canAssignAgentToIssue,
  type PermissionContext,
} from "@multica/core/permissions";

// Settings separates ownership from granted use; native admin inventory access
// does not turn another member's private agent into a shared team resource.
export function settingsAgentLists(
  agents: Agent[],
  context: PermissionContext,
) {
  const active = agents.filter((agent) => !agent.archived_at);
  return {
    mine: active.filter((agent) => agent.owner_id === context.userId),
    team: active.filter(
      (agent) =>
        agent.permission_mode === "public_to" &&
        canAssignAgentToIssue(agent, context).allowed,
    ),
  };
}

export function settingsRuntimeList(runtimes: AgentRuntime[], userId: string) {
  return runtimes.filter((runtime) => isRuntimeUsableForUser(runtime, userId));
}

export function isWorkspaceShared(agent: Agent) {
  return (
    agent.permission_mode === "public_to" &&
    agent.invocation_targets.some(
      (target) => target.target_type === "workspace",
    )
  );
}

// Editing a name/model must preserve a native member-specific allow-list.
export function workspaceSharingUpdate(
  agent: Agent | undefined,
  shared: boolean,
) {
  if (agent && isWorkspaceShared(agent) === shared) return {};
  return {
    permission_mode: shared ? ("public_to" as const) : ("private" as const),
    invocation_targets: shared ? [{ target_type: "workspace" as const }] : [],
  };
}
