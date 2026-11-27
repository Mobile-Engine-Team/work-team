import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import type { AgentTask, TimelineEntry } from "@multica/core/types";
import { useQuery } from "@tanstack/react-query";
import { teamApi, text, useTeam, useTeamAction } from "./client";
import { readTeamDaemon, modelAuthRequest } from "./desktop";
import { Action, Failure, Modal } from "./ui";

export async function ensureAgentAuth(
  agentId: string,
  userId: string,
  workspaceId: string,
) {
  const [agents, runtimes] = await Promise.all([
    teamApi.listAgents({ workspace_id: workspaceId }),
    teamApi.listRuntimes({ workspace_id: workspaceId }),
  ]);
  const agent = agents.find((a) => a.id === agentId);
  const runtime = runtimes.find((r) => r.id === agent?.runtime_id);
  // Only this client can attest its own endpoint configuration.
  if (!runtime || runtime.owner_id !== userId) return;
  const auth = await readTeamDaemon();
  if (auth.daemonId === runtime.daemon_id && auth.state === "restart_required")
    throw new Error("TEAM_ENDPOINT_RESTART_REQUIRED");
}
export function AgentAuthSettings({
  agentId,
  provider,
  authFailed = false,
}: {
  agentId: string;
  provider?: string;
  authFailed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {authFailed ? (
        <Action primary onClick={() => setOpen(true)}>
          {text(provider === "codex" ? "modelResolveAuth" : "modelConfigGuide")}
        </Action>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Action aria-label={text("moreActions")} />}
          >
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setOpen(true)}>
              {text("modelSettings")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {open && (
        <Modal title={text("modelSettings")} onClose={() => setOpen(false)}>
          <AgentAuthPanel agentId={agentId} />
        </Modal>
      )}
    </>
  );
}
export function needsModelAuth(
  run: Pick<AgentTask, "status" | "error" | "failure_reason">,
) {
  return (
    run.status === "failed" &&
    runFailureHint(run.error, run.failure_reason) === "modelAuthRequired"
  );
}
export function AgentAuthPanel({ agentId }: { agentId: string }) {
  const { workspace, user } = useTeam();
  const provider = useQuery({
    queryKey: ["team", workspace.id, user.id, "authProvider", agentId],
    queryFn: async () => {
      const [agents, runtimes, daemon] = await Promise.all([
        teamApi.listAgents({ workspace_id: workspace.id }),
        teamApi.listRuntimes({ workspace_id: workspace.id }),
        readTeamDaemon(),
      ]);
      const runtime = runtimes.find(
        (r) => r.id === agents.find((a) => a.id === agentId)?.runtime_id,
      );
      return {
        provider: runtime?.provider,
        local:
          runtime?.owner_id === user.id &&
          runtime?.daemon_id === daemon.daemonId,
      };
    },
  });
  if (provider.isPending) return <p>{text("loading")}</p>;
  return (
    <>
      <Failure error={provider.error} />
      {provider.data &&
        (provider.data.local ? (
          <ModelAuthPanel provider={provider.data.provider || "unknown"} />
        ) : (
          <p>{text("probeRemote")}</p>
        ))}
    </>
  );
}
export function ModelAuthPanel({ provider = "codex" }: { provider?: string }) {
  if (provider !== "codex")
    return (
      <section className="team-auth-panel">
        <strong>
          {provider} · {text("nativeAgentConfig")}
        </strong>
        <p>{text("providerConfigHint")}</p>
        <p>{text("modelSharedConfig")}</p>
      </section>
    );
  return <CodexAuthPanel />;
}
export function useCodexModelAuth(enabled = true) {
  const { user } = useTeam();
  return useQuery({
    queryKey: ["team", "modelAuth", user.id],
    queryFn: () => modelAuthRequest("team:modelAuthStatus", user.id),
    enabled,
    refetchInterval: (q) => (q.state.data?.signingIn ? 1500 : false),
    refetchIntervalInBackground: true,
  });
}
function CodexAuthPanel() {
  const { user } = useTeam();
  const status = useCodexModelAuth();
  const action = useTeamAction(
    async (mode: "team:loginModel" | "team:importModelAuth") =>
      modelAuthRequest(mode, user.id),
  );
  return (
    <section className="team-auth-panel">
      <strong>{text("modelAuthTitle")}</strong>
      <p role="status">
        {text(
          status.isPending
            ? "loading"
            : status.isError
              ? "modelAuthorizationUnavailable"
              : status.data.state === "restart_required"
                ? "modelReenableRequired"
                : status.data.state !== "running"
                  ? "modelAuthorizationOffline"
                  : status.data.signingIn
                    ? "modelSigningIn"
                    : status.data.configured
                      ? "modelConfigured"
                      : "modelNotConfigured",
        )}
      </p>
      <p>{text("modelAuthHint")}</p>
      <div className="team-actions">
        <Action
          disabled={
            status.isPending ||
            status.data?.state !== "running" ||
            action.isPending ||
            status.data?.signingIn
          }
          onClick={() => action.mutate("team:loginModel")}
        >
          {text("modelLogin")}
        </Action>
        <Action
          disabled={
            status.isPending ||
            status.data?.state !== "running" ||
            action.isPending ||
            status.data?.signingIn
          }
          onClick={() => action.mutate("team:importModelAuth")}
        >
          {text("modelImport")}
        </Action>
        <Action onClick={() => void status.refetch()}>{text("refresh")}</Action>
      </div>
      {status.data?.loginError && (
        <p role="alert">{text("modelLoginFailed")}</p>
      )}
      <Failure error={status.error || action.error} />
    </section>
  );
}
export function runFailureHint(
  error: string | null | undefined,
  reason?: string,
) {
  if (
    reason === "agent_error.provider_auth_or_access" ||
    /\b401\b|missing bearer|unauthorized|TEAM_MODEL_AUTH_REQUIRED/i.test(
      error || "",
    )
  )
    return "modelAuthRequired";
  if (/\b429\b|rate.limit|quota/i.test(error || "")) return "modelRateLimited";
  if (/timeout|timed out|network|connection/i.test(error || ""))
    return "modelNetworkError";
  return "executionFailedHint";
}

// Only generated error comments are summarized. Member text and partial deliveries stay intact.
export function failureForEntry(
  entry: Pick<TimelineEntry, "actor_type" | "source_task_id" | "content">,
  runs: readonly Pick<
    AgentTask,
    "id" | "status" | "error" | "failure_reason"
  >[],
) {
  if (entry.actor_type !== "agent") return undefined;
  return runs.find(
    (r) =>
      r.id === entry.source_task_id &&
      r.status === "failed" &&
      r.error &&
      (entry.content === r.error ||
        /^unexpected status 401/i.test(entry.content || "")),
  );
}
