import { invoke } from "@team-workbench/multica-host/client-api";

// Only a login marker lives in sessionStorage. The DSH Host owns the upstream JWT.
export async function passwordSignIn(mode: "register" | "login", username: string, password: string) {
  try {
    const { user } = await invoke("session." + mode, { username, password });
    return { ok: true, token: user.id + "/" + crypto.randomUUID() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "server_unreachable" };
  }
}

export const passwordSignOut = () => invoke("session.logout");
