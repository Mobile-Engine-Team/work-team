import { useEffect, useState } from "react";
import { LoginShell } from "../auth/login-shell";
import { PasswordLoginForm } from "../auth/password-login-form";
import { WorkbenchShell } from "../workbench/workbench";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, ArrowRight } from "lucide-react";
import {
  TeamQueryProvider,
  TeamScope,
  teamApi,
  text,
  useTeamAction,
  useTeamSession,
  useTeam,
} from "./client";
import { Action, Field, Input, Picker, Failure, Empty, Modal, TeamConnectionNotice } from "./ui";
import { usePageAssembly } from "../pages";
import { ProjectsPage } from "./projects";
import { Invitations, useAcceptWorkspaceInvitation } from "./invitations";
import "./team.css";
export default function TeamPage({ showInvitationNotifications = false }: { showInvitationNotifications?: boolean }) {
  return (
    <TeamQueryProvider>
      <TeamEntry showInvitationNotifications={showInvitationNotifications} />
    </TeamQueryProvider>
  );
}
function TeamEntry({ showInvitationNotifications }: { showInvitationNotifications: boolean }) {
  const { slug, issueId } = useParams();
  const navigate = useNavigate();
  const session = useTeamSession();
  const [create, setCreate] = useState(false);
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const action = useTeamAction(async (mode: string) => {
    if (mode === "logout") { await session.logout(); navigate("/team"); }
    else {
      const ws = await teamApi.createWorkspace({
        name: workspaceName,
        slug: workspaceSlug,
      });
      setCreate(false);
      navigate(`/team/${ws.slug}`);
    }
  });
  const spaces = useQuery({
    queryKey: ["team", "workspaces"],
    queryFn: () => teamApi.listWorkspaces(),
    enabled: !!session.user.data,
  });
  const invites = useQuery({
    queryKey: ["team", "invitations"],
    queryFn: () => teamApi.listMyInvitations(),
    refetchInterval: 5000,
    enabled: !!session.user.data && !showInvitationNotifications,
  });
  const accept = useAcceptWorkspaceInvitation(session.user.data?.id);
  const workspace = spaces.data?.find((w) => w.slug === slug);
  useEffect(() => {
    if (!slug && spaces.data?.length) {
      const initial = spaces.data.find(w => w.kind === "personal") || spaces.data[0];
      navigate(`/team/${initial.slug}`, {replace:true});
    }
  }, [slug, spaces.data, navigate]);
  if (!session.signedIn)
    return (
      <>
        <TeamSignIn onLogin={async (mode, username, password) => { const result = await session.login(mode,username,password); if(result.ok) navigate("/team",{replace:true}); return result; }} />
      </>
    );
  if (!session.user.data)
    return (
      <div className="team-root">
        <TeamConnectionNotice />
        <Failure
          error={session.user.error}
          retry={() => void session.user.refetch()}
        />
        <Empty>{text("loading")}</Empty>
        <Action onClick={() => action.mutate("logout")}>
          {text("logout")}
        </Action>
      </div>
    );
  return (
    <div className="team-root">
      {showInvitationNotifications && <Invitations key={session.user.data.id} />}
        <TeamConnectionNotice />
      <header className="team-header">
        <div className="team-heading">
          <span className="team-page-label">{text("wb.home")}</span>
          <Picker
            label={text("workspace")}
            emptyLabel={text(
              spaces.isPending
                ? "loading"
                : spaces.isError
                  ? "workspaceLoadFailed"
                  : "noWorkspaces",
            )}
            value={workspace?.slug || ""}
            options={(spaces.data || []).map((w) => ({
              value: w.slug,
              label: `${w.name} · ${w.kind === "personal" ? text("wb.personal") : text("workspaceTeam")}`,
            }))}
            onChange={(v) => navigate(`/team/${v}`)}
          />
          <Action
            onClick={() => setCreate(true)}
            aria-label={text("createWorkspace")}
          >
            <Plus size={16} />
          </Action>
        </div>
        <Action onClick={() => action.mutate("logout")}>{text("logout")}</Action>
      </header>
      <Failure
        error={spaces.error || invites.error || action.error || accept.error}
      />
      {workspace ? (
        <TeamScope
          key={workspace.id}
          workspace={workspace}
          user={session.user.data}
        >
          <WorkspaceScreen issueId={issueId} />
        </TeamScope>
      ) : (
        <div className="team-content">
          {spaces.isPending ? (
            <Empty>{text("loading")}</Empty>
          ) : spaces.data?.length === 0 ? (
            <section className="team-welcome">
              <Users size={32} />
              <h1>{text("emptyTeamTitle")}</h1>
              <p>{text("emptyTeamHint")}</p>
              <Action primary onClick={() => setCreate(true)}>
                <Plus size={16} />
                {text("createWorkspace")}
              </Action>
            </section>
          ) : (
            <h1>{text("chooseWorkspace")}</h1>
          )}
          {!!spaces.data?.length && (
            <div className="team-workspace-grid">
              {spaces.data?.map((w) => (
                <button
                  className="team-workspace-card"
                  key={w.id}
                  onClick={() => navigate(`/team/${w.slug}`)}
                >
                  <span className="team-workspace-icon">
                    <Users size={22} />
                  </span>
                  <span className="team-workspace-info">
                    <strong>{w.name}</strong>
                    <span>{w.description || text(w.kind === "personal" ? "wb.personal" : "workspaceTeam")}</span>
                  </span>
                  <ArrowRight size={18} className="team-workspace-arrow" />
                </button>
              ))}
            </div>
          )}
          {!showInvitationNotifications && <div className="team-invitations">
            {invites.data
              ?.filter((i) => i.status === "pending")
              .map((i) => (
                <article className="team-invitation-card" key={i.id}>
                  <div>
                    <small>{text("invitation")}</small>
                    <h2>{i.workspace_name}</h2>
                  </div>
                  <Action
                    primary
                    disabled={accept.isPending}
                    onClick={() => accept.mutate(i)}
                  >
                    {text("acceptInvite")}
                  </Action>
                  {accept.variables?.id === i.id && <Failure error={accept.error} />}
                </article>
              ))}
          </div>}
        </div>
      )}
      {create && (
        <Modal title={text("createWorkspace")} onClose={() => setCreate(false)}>
          <Field label={text("name")}>
            <Input
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </Field>
          <Field label={text("slug")}>
            <Input
              value={workspaceSlug}
              onChange={(e) => setWorkspaceSlug(e.target.value)}
              placeholder="customer-service"
            />
          </Field>
          <Failure error={action.error} />
          <Action
            primary
            disabled={
              action.isPending || !workspaceName.trim() || !workspaceSlug.trim()
            }
            onClick={() => action.mutate("create")}
          >
            {text("create")}
          </Action>
        </Modal>
      )}
    </div>
  );
}
function WorkspaceScreen({ issueId }: { issueId?: string }) {
  const { workspace } = useTeam();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { entries, renderPage } = usePageAssembly();
  const view = params.get("view") || "workbench";
  const selected = issueId ? "tasks" : view;
  const fallback = selected === "inbox" && entries.has("tasks") ? "tasks" : "workbench";
  const tab = selected === "workbench" || selected === "projects" || entries.has(selected) ? selected : fallback;
  useEffect(() => {
    if (selected !== tab) navigate(`/team/${workspace.slug}?view=${tab}`, { replace: true });
  }, [selected, tab, workspace.slug, navigate]);
  return <WorkbenchShell view={issueId ? view : tab} issueId={issueId}>
    <main className="team-content">
      {tab === "projects" ? <ProjectsPage /> : entries.has(tab) && renderPage(tab, {
        issueId, onOpen: (id: string, commentId?: string) =>
          navigate(`/team/${workspace.slug}/issue/${id}${commentId ? `?comment=${encodeURIComponent(commentId)}` : ""}`),
      })}
    </main>
  </WorkbenchShell>;
}
export function TeamSignIn({onLogin}:{onLogin:(mode:"login"|"register",username:string,password:string)=>Promise<{ok:boolean;error?:string}>}) {
 return <LoginShell><PasswordLoginForm loginWithPassword={onLogin}/></LoginShell>;
}
