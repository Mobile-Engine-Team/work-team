import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiClient, setApiInstance } from "@multica/core/api";
import { setCurrentWorkspace } from "@multica/core/platform/workspace-storage";
import type { Workspace, User } from "@multica/core/types";
import { passwordSignIn, passwordSignOut } from "./password-auth";
import { stopTeamDaemon } from "./desktop";
import { createTeamQueryClient, resumeTeamQueries, subscribeTeamResume } from "./connection-recovery";
import { teamFetch } from "./request-transport";
import { currentLocale, t } from "@/i18n";
import { experienceCopy } from "./experience-copy";

export const text = (key: string) => {
  const locale = currentLocale();
  return experienceCopy[key]?.[locale === "zh" ? "zh" : "en"] ?? t(`team.${key}`, locale);
};
export const teamServer = location.origin;
const tokenKey = "workbench.session.account";
export const teamToken = () => sessionStorage.getItem(tokenKey);
export const teamApi = new ApiClient(teamServer, {
  fetchTransport: teamFetch,
  getToken: () => sessionStorage.getItem(tokenKey),
  onUnauthorized: () => {
    sessionStorage.removeItem(tokenKey);
    window.dispatchEvent(new Event("team:expired"));
  },
});
// Native core queries must use the same server, token and workspace as MW.
setApiInstance(teamApi);
const TeamContext = createContext<{ workspace: Workspace; user: User } | null>(
  null,
);
export function useTeam() {
  const value = useContext(TeamContext);
  if (!value) throw new Error("Missing team context");
  return value;
}
export function TeamQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createTeamQueryClient);
  useEffect(() => {
    let resuming = false;
    return subscribeTeamResume(() => {
      if (resuming) return;
      resuming = true;
      void resumeTeamQueries(client).finally(() => { resuming = false; });
    });
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
export function useTeamSession() {
  const client = useQueryClient();
  const [signedIn, setSignedIn] = useState(
    () => !!sessionStorage.getItem(tokenKey),
  );
  useEffect(() => {
    const expired = () => {
      setSignedIn(false);
      client.clear();
    };
    const changed = () => {
      void client.invalidateQueries({ queryKey: ["team"] });
    };
    window.addEventListener("team:expired", expired);
    window.addEventListener("team:workspaces-changed", changed);
    return () => {
      window.removeEventListener("team:expired", expired);
      window.removeEventListener("team:workspaces-changed", changed);
    };
  }, [client]);
  const user = useQuery({
    queryKey: ["team", "me"],
    queryFn: () => teamApi.getMe(),
    enabled: signedIn,
  });
  return {
    user,
    signedIn,
    login: async (mode:"login"|"register", username:string, password:string) => {
      const response=await passwordSignIn(mode,username,password);
      if(response.ok && response.token){ sessionStorage.setItem(tokenKey,response.token); sessionStorage.setItem("mobilework.demoPasswordAuth","1"); client.clear();setSignedIn(true); }
      return {ok:response.ok,error:response.error};
    },
    logout: async () => {
      await stopTeamDaemon();
      await passwordSignOut();
      sessionStorage.removeItem(tokenKey);
      setSignedIn(false);
      client.clear();
      if (sessionStorage.getItem("mobilework.demoPasswordAuth") === "1")
        window.dispatchEvent(new Event("demo:logout"));
    },
  };
}
export function TeamScope({
  workspace,
  user,
  children,
}: {
  workspace: Workspace;
  user: User;
  children: ReactNode;
}) {
  const client = useQueryClient();
  const [ready, setReady] = useState(false);
  const [connection, setConnection] = useState(0);
  useEffect(() => subscribeTeamResume(() => setConnection((value) => value + 1)), []);
  useLayoutEffect(() => {
    setCurrentWorkspace(workspace.slug, workspace.id);
    setReady(true);
    return () => {
      setCurrentWorkspace(null, null);
    };
  }, [workspace.id, workspace.slug]);
  useEffect(() => {
    const events = new EventSource("/api/workbench/events?workspace=" + encodeURIComponent(workspace.slug));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = new Set<string>();
    const refresh = (keys: string[]) => {
      keys.forEach((key) => pending.add(key));
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const keys = new Set(pending);
        pending.clear();
        void client.invalidateQueries({
          predicate: (query) =>
            query.queryKey[0] === "team" &&
            query.queryKey[1] === workspace.id &&
            keys.has(String(query.queryKey[2])),
        });
      }, 200);
    };
    events.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (typeof message.type !== "string") return;
      const kind = message.type.split(":")[0];
      refresh(["workbench"]);
      if (kind === "member") {
        client.removeQueries({ queryKey: ["team", workspace.id, "workbench"] });
        void client.invalidateQueries({ queryKey: ["team", "workspaces"] });
      }
      if (kind === "task")
        refresh([
          "runs",
          "taskSnapshot",
          "runMessages",
          "squadStatus",
          "timeline",
          "issue",
          "issues",
          "blueprint",
        ]);
      else if (
        kind === "comment" ||
        kind === "activity" ||
        kind === "issue_attachments"
      )
        refresh(["timeline", "attachments", "issue", "issues", "projectMessages"]);
      else if (kind === "agent" || kind === "daemon")
        refresh(["agents", "runtimes", "daemon", "taskSnapshot", "runs", "squadStatus"]);
      else if (kind === "squad" || kind === "squad_member")
        refresh(["squads", "squad", "squadMembers", "squadStatus", "timeline"]);
      else if (kind === "project") refresh(["projects", "project", "blueprint", "topics", "projectMessages", "issues", "issue", "inbox"]);
      else if (kind === "inbox") refresh(["inbox"]);
      else if (kind === "member") refresh(["members"]);
      else if (kind === "subscriber") refresh(["subscribers"]);
      else if (kind.startsWith("issue"))
        refresh(["issue", "issues", "statuses", "trigger", "topics", "blueprint"]);
    };
    events.onopen = () => {
      void client.invalidateQueries({ queryKey: ["team"] });
    };
    return () => {
      if (timer) clearTimeout(timer);
      events.close();
    };
  }, [workspace.id, workspace.slug, client, connection]);
  return ready ? (
    <TeamContext.Provider value={{ workspace, user }}>
      {children}
    </TeamContext.Provider>
  ) : null;
}
export function useTeamQuery<T>(
  key: readonly unknown[],
  queryFn: () => Promise<T>,
  enabled = true,
) {
  const { workspace } = useTeam();
  return useQuery({
    queryKey: ["team", workspace.id, ...key],
    queryFn,
    enabled,
  });
}
export function useTeamAction<T = void, R = unknown>(
  action: (data: T) => Promise<R>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["team"] }); },
  });
}
