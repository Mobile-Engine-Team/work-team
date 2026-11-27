import { z } from "zod";
import { teamServer, text } from "./client";
import {
  localizeMobileWorkIpcResult,
  toMobileWorkIpcError,
} from "@/app/lib/ipc-error";
const StatusSchema = z.object({
  ok: z.literal(true),
  state: z.string(),
  daemonId: z.string().optional(),
});
export function teamDesktopBridge() {
  return { async invoke(action: string, payload: Record<string, unknown>) {
    const response = await fetch("/api/workbench/desktop", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || text("failed"));
    return result;
  } };
}
async function invoke(action: string, payload: Record<string, unknown>) {
  const desktop = teamDesktopBridge();
  if (!desktop) throw new Error(text("desktopOnly"));
  const result = localizeMobileWorkIpcResult(
    await desktop.invoke(action, payload),
  );
  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    result.ok === false
  ) {
    throw new Error(
      "error" in result && typeof result.error === "string"
        ? result.error
        : text("failed"),
    );
  }
  return StatusSchema.parse(result);
}
export const readTeamDaemon = () =>
  teamDesktopBridge()
    ? invoke("team:daemonStatus", { serverUrl: teamServer })
    : Promise.resolve({
        ok: true as const,
        state: "unavailable",
        daemonId: undefined,
      });
export const enableTeamDaemon = (payload: { userId: string }) =>
  invoke("team:enableDaemon", { ...payload, serverUrl: teamServer });
export const stopTeamDaemon = () =>
  teamDesktopBridge()
    ? invoke("team:stopDaemon", { serverUrl: teamServer })
    : Promise.resolve({
        ok: true as const,
        state: "stopped",
        daemonId: undefined,
      });

export async function personalLinkRequest(
  action: "team:personalLinks" | "team:savePersonalLink",
  payload: Record<string, unknown> = {},
) {
  const desktop = teamDesktopBridge();
  if (!desktop) throw new Error(text("desktopOnly"));
  const result = localizeMobileWorkIpcResult(
    await desktop.invoke(action, payload),
  );
  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    result.ok === false
  )
    throw new Error(
      text(action === "team:savePersonalLink" ? "linkFailed" : "failed"),
    );
  return result;
}

const ModelAuthSchema = z.object({
  ok: z.literal(true),
  state: z.string(),
  configured: z.boolean(),
  credentialVersion: z.number().optional(),
  signingIn: z.boolean(),
  loginError: z.boolean(),
  daemonId: z.string().nullable(),
});
export async function modelAuthRequest(
  action: "team:modelAuthStatus" | "team:loginModel" | "team:importModelAuth",
  userId: string,
) {
  const desktop = teamDesktopBridge();
  if (!desktop) throw new Error(text("desktopOnly"));
  const result = await desktop.invoke(action, {
    serverUrl: teamServer,
    userId,
  });
  return ModelAuthSchema.parse(result);
}

const AgentProbeSchema = z.object({
  ok: z.literal(true),
  passed: z.boolean(),
  reason: z.string(),
  provider: z.string(),
  model: z.string(),
  checkedAt: z.string(),
});
export async function testTeamAgent(payload: {
  userId: string;
  workspaceSlug: string;
  agentId: string;
}) {
  const desktop = teamDesktopBridge();
  if (!desktop) throw new Error(text("desktopOnly"));
  const result = await desktop.invoke("team:testAgent", {
    ...payload,
    serverUrl: teamServer,
  });
  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    result.ok === false
  ) {
    const error = toMobileWorkIpcError(
      "error" in result ? result.error : result,
    );
    const message = error.diagnosticMessage;
    const hint = message.includes("Team identity does not own this endpoint")
      ? "endpointMismatch"
      : message.includes("RESTART_REQUIRED")
        ? "modelReenableRequired"
        : message.includes("PROBE_REMOTE")
          ? "probeRemote"
          : message.includes("OFFLINE")
            ? "probeOffline"
            : message.includes("BUSY")
              ? "probeBusy"
              : null;
    if (hint) throw new Error(text(hint));
    throw error;
  }
  return AgentProbeSchema.parse(result);
}

export async function connectRemoteHost(payload: { host: string; port: number; username: string; auth: string; password: string; remoteServerUrl: string; userId: string }) {
  try {
    const desktop = teamDesktopBridge();
    if (!desktop) throw new Error(text("desktopOnly"));
    const result = await desktop.invoke("team:connectRemote", { ...payload, serverUrl: teamServer });
    if (result && typeof result === "object" && "ok" in result && result.ok === false) {
      const error = toMobileWorkIpcError("error" in result ? result.error : result);
      throw new Error(error.diagnosticMessage);
    }
    return StatusSchema.parse(result);
  }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    const key = message.includes("REMOTE_HOST_CHANGED") ? "remoteHostChanged" : message.includes("REMOTE_CANCELLED") ? "remoteCancelled" : message.includes("REMOTE_SETUP_FAILED") ? "remoteSetupFailed" : "remoteConnectFailed";
    throw new Error(text(key));
  }
}

export async function readDaemonLog(daemonId:string) {
  const result=await teamDesktopBridge().invoke("team:daemonLogs",{daemonId});
  if(!result.ok) throw new Error(result.error || text("failed"));
  return z.array(z.object({time:z.string(),level:z.string(),event:z.string()})).parse(result.entries);
}
