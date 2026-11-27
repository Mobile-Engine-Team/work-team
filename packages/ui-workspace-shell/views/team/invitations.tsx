import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users, X } from "lucide-react";
import type { Invitation, User, Workspace } from "@multica/core/types";
import {
  teamApi,
  text,
  useTeamSession,
  useTeamAction,
} from "./client";
import { Action, Failure } from "./ui";
import "./team.css";

export function useAcceptWorkspaceInvitation(userId: string | undefined) {
  const navigate = useNavigate();
  const client = useQueryClient();
  return useTeamAction(async (invitation: Invitation) => {
    const member = await teamApi.acceptInvitation(invitation.id);
    const workspaces = await teamApi.listWorkspaces();
    const workspace = workspaces.find((item) => item.id === member.workspace_id);
    if (!workspace) throw new Error(text("joinedWorkspaceUnavailable"));
    const currentUser = () => client.getQueryData<User>(["team", "me"])?.id;
    if (!userId || currentUser() !== userId) return;
    const key = ["team", "workspaces"];
    await client.cancelQueries({ queryKey: key, exact: true });
    if (currentUser() !== userId) return;
    client.setQueryData<Workspace[]>(key, workspaces);
    navigate(`/team/${encodeURIComponent(workspace.slug)}`);
  });
}

export function Invitations() {
  const session = useTeamSession();
  const accept = useAcceptWorkspaceInvitation(session.user.data?.id);
  const [dismissed, setDismissed] = useState<string[]>([]);
  // Invitations are account-scoped; the workspace websocket cannot serve a new user with no workspace.
  // Query manages focus/reconnect and a bounded interval; no manual page refresh is required.
  const query = useQuery({
    queryKey: ["team", "invitations", session.user.data?.id],
    queryFn: () => teamApi.listMyInvitations(),
    enabled: !!session.user.data,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
  // Keep the clicked invitation available for retry if the destination read fails
  // after membership was already saved. AcceptInvitation is idempotent in that case.
  const invitation = accept.isPending || accept.isError
    ? accept.variables
    : query.data?.find(
        (i) => i.status === "pending" &&
          !dismissed.includes(i.id) &&
          i.id !== (accept.isSuccess ? accept.variables?.id : undefined),
      );
  if (!invitation) return null;
  return (
    <aside
      className="team-root team-invite-toast"
      role="status"
      aria-live="polite"
    >
      <div className="team-toolbar">
        <Users size={20} />
        <strong>{text("invitation")}</strong>
        <Action
          size="icon-sm"
          aria-label={text("dismissInvite")}
          disabled={accept.isPending}
          onClick={() => {
            setDismissed((previous) => [...previous, invitation.id]);
            accept.reset();
          }}
        >
          <X size={14} />
        </Action>
      </div>
      <p>{invitation.workspace_name}</p>
      <Action
        primary
        disabled={accept.isPending}
        onClick={() => accept.mutate(invitation)}
      >
        {text(accept.isPending ? "working" : "acceptInvite")}
      </Action>
      <Failure error={accept.error} />
    </aside>
  );
}
