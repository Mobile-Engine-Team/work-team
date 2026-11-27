import { useState, type ReactNode } from "react";
import { probeNeedsAuth } from "./model-auth-state";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Agent } from "@multica/core/types";
import { PlugZap, CircleCheck, CircleAlert, LoaderCircle } from "lucide-react";
import { teamApi, text, useTeam } from "./client";
import { testTeamAgent } from "./desktop";
import { Action, Modal } from "./ui";
import { AgentAuthSettings, ModelAuthPanel } from "./model-auth";

export function AgentProbe({
  agent,
  provider,
  endpointHint,
  remote = false,
  children,
}: {
  agent: Pick<Agent, "id" | "name" | "model">;
  provider?: string;
  endpointHint?: string;
  remote?: boolean;
  children?: ReactNode;
}) {
  const { user, workspace } = useTeam();
  const [open, setOpen] = useState(false);
  const localProbe = useMutation({
    mutationFn: () =>
      testTeamAgent({
        userId: user.id,
        workspaceSlug: workspace.slug,
        agentId: agent.id,
      }),
  });
  const start = useMutation({
    mutationFn: () => teamApi.startModelProbe(agent.id, crypto.randomUUID()),
  });
  const cancel = useMutation({
    mutationFn: async () => {
      if (start.data) await teamApi.cancelModelProbe(start.data.id);
      await result.refetch();
    },
  });
  const result = useQuery({
    queryKey: ["team", workspace.id, "modelProbe", start.data?.id],
    queryFn: () => teamApi.getModelProbe(start.data!.id),
    enabled: remote && !!start.data,
    refetchInterval: (q) =>
      !q.state.data || ["queued", "running"].includes(q.state.data.status)
        ? 1500
        : false,
  });
  const pending =
    remote &&
    !!start.data &&
    (!result.data || ["queued", "running"].includes(result.data.status));
  const remoteError = start.error || result.error || cancel.error;
  const message = remoteError instanceof Error ? remoteError.message : "";
  const remoteHint = message.includes("TEAM_PROBE_UPGRADE")
    ? "probeUpgrade"
    : message.includes("OFFLINE")
      ? "probeOffline"
      : message.includes("BUSY")
        ? "probeBusy"
        : "probeUnavailable";
  const probe = remote
    ? {
        isPending: start.isPending || pending,
        data:
          !pending && result.data?.status !== "cancelled"
            ? result.data
            : undefined,
        error: remoteError ? new Error(text(remoteHint)) : null,
        mutate: () => {
          cancel.reset();
          start.mutate();
        },
      }
    : localProbe;
  return (
    <>
      <Action onClick={() => setOpen(true)}>
        <PlugZap size={14} />
        {text("probeAgent")}
      </Action>
      {children}
      {!remote && !endpointHint && (
        <AgentAuthSettings
          agentId={agent.id}
          provider={provider}
          authFailed={probeNeedsAuth(probe.data, probe.isPending, probe.error)}
        />
      )}
      {open && (
        <Modal
          title={`${text("probeAgent")} · ${agent.name}`}
          onClose={() => setOpen(false)}
        >
          <div className="team-probe-config">
            <span className="team-probe-tool">
              <PlugZap size={18} aria-hidden="true" />
              {provider}
            </span>
            <div className="team-probe-model">
              <span>{text("probeCurrentModel")}</span>
              <strong>{agent.model || text("modelDefault")}</strong>
            </div>
          </div>
          <p className="team-probe-hint">{text("probeHint")}</p>
          {endpointHint && (
            <p role="alert" className="team-probe-hint">
              {text(endpointHint)}
            </p>
          )}
          {probe.isPending && (
            <div
              role="status"
              className="team-probe-result"
              data-state="pending"
            >
              <span className="team-probe-icon">
                <LoaderCircle
                  size={20}
                  className="animate-spin"
                  aria-hidden="true"
                />
              </span>
              <div className="team-probe-copy">
                <strong>{text("probeWorking")}</strong>
                <p>
                  {text(
                    remote && result.data?.status === "queued"
                      ? "probeQueued"
                      : "probeWaiting",
                  )}
                </p>
              </div>
            </div>
          )}
          {probe.data && !probe.isPending && !probe.error && (
            <div
              role="status"
              className="team-probe-result"
              data-state={probe.data.passed ? "passed" : "failed"}
            >
              <span className="team-probe-icon">
                {probe.data.passed ? (
                  <CircleCheck size={20} aria-hidden="true" />
                ) : (
                  <CircleAlert size={20} aria-hidden="true" />
                )}
              </span>
              <div className="team-probe-copy">
                <strong>
                  {text(probe.data.passed ? "probePassed" : "probeFailed")}
                </strong>
                <p>
                  {text(
                    probe.data.passed
                      ? "probeSuccessHint"
                      : probe.data.reason === "auth"
                        ? "probeAuth"
                        : probe.data.reason === "model"
                          ? "probeModel"
                          : probe.data.reason === "network"
                            ? "probeNetwork"
                            : probe.data.reason === "timeout"
                              ? "probeTimeout"
                              : probe.data.reason === "not_installed"
                                ? "probeNotInstalled"
                                : "probeOther",
                  )}
                </p>
                <time dateTime={probe.data.checkedAt}>
                  {text("probeCheckedAt")} ·{" "}
                  {new Date(probe.data.checkedAt).toLocaleString()}
                </time>
              </div>
            </div>
          )}
          {probe.error && !probe.isPending && (
            <div role="alert" className="team-probe-result" data-state="failed">
              <span className="team-probe-icon">
                <CircleAlert size={20} aria-hidden="true" />
              </span>
              <div className="team-probe-copy">
                <strong>{text("probeFailed")}</strong>
                <p>{probe.error.message}</p>
              </div>
            </div>
          )}
          {!remote &&
            probeNeedsAuth(probe.data, probe.isPending, probe.error) && (
              <ModelAuthPanel provider={provider || "unknown"} />
            )}
          {remote && result.data?.status === "cancelled" && (
            <p role="status">{text("probeCancelled")}</p>
          )}
          {remote && remoteError && probe.isPending && (
            <p role="alert">{text(remoteHint)}</p>
          )}
          <div className="team-probe-footer">
            {remote && pending && (
              <Action
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                {text("probeCancel")}
              </Action>
            )}
            <Action onClick={() => setOpen(false)}>
              {text(probe.data?.passed ? "probeDone" : "probeClose")}
            </Action>
            <Action
              primary={!probe.data?.passed}
              disabled={probe.isPending || !!endpointHint}
              onClick={() => probe.mutate()}
            >
              {text(
                probe.isPending
                  ? "probeWorking"
                  : probe.data || probe.error
                    ? "probeAgain"
                    : "probeAgent",
              )}
            </Action>
          </div>
        </Modal>
      )}
    </>
  );
}
