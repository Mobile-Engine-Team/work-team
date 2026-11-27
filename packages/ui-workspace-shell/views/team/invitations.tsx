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
import { Action, Failure, Modal } from "./ui";
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

export function InvitationLink({id,userId,close}:{id:string;userId:string;close:()=>void}){
  const record=useQuery({queryKey:["team","invitation",id,userId],queryFn:()=>teamApi.getInvitation(id),retry:false});
  const accept=useAcceptWorkspaceInvitation(userId);
  const navigate=useNavigate();
  const enter=useTeamAction(async()=>{
    const team=(await teamApi.listWorkspaces()).find(w=>w.id===record.data?.workspace_id);
    if(!team)throw Error("当前账号已不在该团队");
    navigate("/team/"+team.slug,{replace:true});
  });
  const invitation=record.data;
  const expired=!!invitation?.expires_at && Date.parse(invitation.expires_at)<=Date.now();
  return <Modal title="团队邀请" onClose={close}>
    {record.isPending&&<p role="status">正在读取邀请…</p>}
    {record.error&&<p role="alert">当前账号没有可接受的邀请。</p>}
    {invitation&&<><strong>{invitation.workspace_name}</strong><p>{invitation.inviter_name} 邀请你以{invitation.role==="admin"?"管理员":"成员"}身份加入团队。</p>
      {invitation.status!=="pending"||expired?<div><p>{invitation.status==="accepted"?"已接受邀请":"邀请已失效"}</p>{invitation.status==="accepted"&&<Action primary disabled={enter.isPending} onClick={()=>enter.mutate()}>进入团队</Action>}</div>:<Action primary disabled={accept.isPending} onClick={()=>accept.mutate(invitation)}>接受并加入</Action>}</>}
    <Failure error={accept.error||enter.error}/><Action onClick={close}>关闭</Action>
  </Modal>;
}
