import { AssignedWork, ObjectLinks } from "./assigned-work";
import { Directory } from "./directory";
import { IDSchema, request } from "../workbench/api";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Users,
  Crown,
  Archive,
  UserPlus,
} from "lucide-react";
import type { Squad, SquadMember } from "@multica/core/types";
import { teamApi, text, useTeam, useTeamQuery, useTeamAction } from "./client";
import { useTeamPeople } from "./tasks";
import {
  Action,
  Avatar,
  Empty,
  Failure,
  Field,
  Input,
  Modal,
  Picker,
  Textarea,
} from "./ui";
import { TeamMarkdown } from "./markdown";

export function SquadsPage() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("squad");
  const people = useTeamPeople();
  const { user } = useTeam();
  const [scope, setScope] = useState("全部小队");
  const [create, setCreate] = useState(false);
  const open = (id?: string) =>
    setParams({ view: "squads", ...(id ? { squad: id } : {}) });
  const squads = (people.squads.data || []).filter((s) => !s.archived_at);
  return (
    <>
      {selected ? (
        <SquadDetail key={selected} id={selected} onBack={() => open()} />
      ) : (
        <>
          <Failure
            error={
              people.squads.error || people.agents.error || people.members.error
            }
            retry={() => {
              void people.squads.refetch();
              void people.agents.refetch();
              void people.members.refetch();
            }}
          />
          <Directory
            kind="小队"
            loading={people.squads.isPending}
            scope={scope}
            onScope={setScope}
            onOpen={open}
            onCreate={() => setCreate(true)}
            items={squads.map((s) => ({
              id: s.id,
              name: s.name,
              avatar: s.avatar_url,
              description: s.description,
              owner: people.name(s.creator_id),
              mine: s.creator_id === user.id,
              first: people.name(s.leader_id),
              second: "",
              people:s.member_preview?.map(m=>({id:m.member_type+":"+m.member_id,label:people.name(m.member_id),agent:m.member_type==="agent"})),
              members: s.member_count ?? s.member_preview?.length ?? 0,
            }))}
          />
        </>
      )}
      {create && (
        <SquadEditor
          people={people}
          onClose={() => setCreate(false)}
          onSaved={(s) => {
            setCreate(false);
            open(s.id);
          }}
        />
      )}
    </>
  );
}

function SquadEditor({
  squad,
  people,
  onClose,
  onSaved,
}: {
  squad?: Squad;
  people: ReturnType<typeof useTeamPeople>;
  onClose: () => void;
  onSaved: (s: Squad) => void;
}) {
  const [name, setName] = useState(squad?.name || "");
  const [description, setDescription] = useState(squad?.description || "");
  const [leader, setLeader] = useState(squad?.leader_id || "");
  const [instructions, setInstructions] = useState(squad?.instructions || "");
  const action = useTeamAction(async () => {
    const fields = {
      name: name.trim(),
      description: description.trim(),
      leader_id: leader,
      instructions,
    };
    const result = squad
      ? await teamApi.updateSquad(squad.id, fields)
      : await teamApi.createSquad(fields);
    onSaved(result);
  });
  const admin = people.role === "owner" || people.role === "admin";
  const leaders = (people.agents.data || []).filter(
    (a) =>
      !a.archived_at &&
      (!!a.runtime_id || a.system_key === "mobilework") &&
      (admin || people.allowed(a)),
  );
  return (
    <Modal
      title={text(squad ? "editSquad" : "createSquad")}
      onClose={() => {
        if (!action.isPending) onClose();
      }}
      wide
    >
      <fieldset disabled={action.isPending} className="team-create-fields">
        <Field label={text("squadName")}>
          <Input
            autoFocus
            maxLength={255}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={text("squadNameHint")}
          />
        </Field>
        <Field label={text("squadDescription")}>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label={text("squadLeader")}>
          <Picker
            label={text("chooseLeader")}
            value={leader}
            options={leaders.map((a) => ({ value: a.id, label: a.name }))}
            onChange={setLeader}
          />
        </Field>
        <p className="team-squad-help">
          {text(squad ? "squadLeaderHint" : "squadCreateHint")}
        </p>
        <Field label={text("squadInstructions")}>
          <Textarea
            rows={6}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder={text("squadInstructionsHint")}
          />
        </Field>
      </fieldset>
      <Failure error={action.error || people.agents.error} />
      <div className="team-modal-actions">
        <Action disabled={action.isPending} onClick={onClose}>
          {text("cancel")}
        </Action>
        <Action
          primary
          disabled={action.isPending || !name.trim() || !leader}
          onClick={() => action.mutate()}
        >
          {text(action.isPending ? "working" : squad ? "save" : "createSquad")}
        </Action>
      </div>
    </Modal>
  );
}

function SquadDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { user, workspace } = useTeam();
  const people = useTeamPeople();
  const squad = useTeamQuery(["squad", id], () => teamApi.getSquad(id));
  const members = useTeamQuery(["squadMembers", id], () =>
    teamApi.listSquadMembers(id),
  );
  const status = useTeamQuery(["squadStatus", id], () =>
    teamApi.getSquadMemberStatus(id),
  );
  const [, routeTo] = useSearchParams();
  const openRoom = useTeamAction(async () => {
    const room = await request(workspace.id, "/squad-room/" + id, IDSchema, {});
    routeTo({ view: "rooms", room: room.id });
  });
  const [edit, setEdit] = useState(false);
  const [archive, setArchive] = useState(false);
  const [memberEditor, setMemberEditor] = useState<SquadMember | "new" | null>(
    null,
  );
  const [remove, setRemove] = useState<SquadMember | null>(null);
  const action = useTeamAction(async (mode: "archive" | "remove") => {
    if (mode === "archive") {
      await teamApi.deleteSquad(id);
      onBack();
    } else if (remove) {
      await teamApi.removeSquadMember(id, remove);
      setRemove(null);
    }
  });
  const s = squad.data;
  const canManage =
    !!s &&
    !s.archived_at &&
    (people.role === "owner" ||
      people.role === "admin" ||
      s.creator_id === user.id);
  return (
    <>
      <button className="team-back" onClick={onBack}>
        <ArrowLeft size={16} />
        {text("backToSquads")}
      </button>
      <Failure
        error={
          squad.error ||
          members.error ||
          status.error ||
          people.agents.error ||
          people.members.error
        }
        retry={() => {
          void squad.refetch();
          void members.refetch();
          void status.refetch();
          void people.agents.refetch();
          void people.members.refetch();
        }}
      />
      {!s ? (
        squad.isPending && <Empty>{text("loading")}</Empty>
      ) : (
        <>
          <div className="team-squad-heading">
            <span className="team-workspace-icon">
              <Users size={28} />
            </span>
            <div>
              <small>{text("mentionSquad")}</small>
              <h1>{s.name}</h1>
              <ObjectLinks id={s.id} />
              <Action
                onClick={() =>
                  routeTo({
                    view: "tasks",
                    create: "1",
                    owner: "squad:" + s.id,
                  })
                }
              >
                分配工作
              </Action>
              <Action
                disabled={openRoom.isPending}
                onClick={() => openRoom.mutate()}
              >
                用小队开聊
              </Action>
              <Failure error={openRoom.error} />
              <p>{s.description || text("squadNoDescription")}</p>
            </div>
            {canManage && (
              <div className="team-actions">
                <Action onClick={() => setEdit(true)}>
                  {text("editSquad")}
                </Action>
                <Action
                  aria-label={text("archiveSquad")}
                  onClick={() => setArchive(true)}
                >
                  <Archive size={16} />
                </Action>
              </div>
            )}
          </div>
          <AssignedWork key={s.id} id={s.id} />
          {s.archived_at && (
            <div className="team-notice">{text("squadArchived")}</div>
          )}
          <div className="team-squad-detail-grid">
            <section className="team-squad-roster">
              <div className="team-toolbar">
                <h2>
                  {text("squadMembers")}{" "}
                  <small>{members.data?.length ?? "—"}</small>
                </h2>
                {canManage && (
                  <Action size="sm" onClick={() => setMemberEditor("new")}>
                    <UserPlus size={15} />
                    {text("addSquadMember")}
                  </Action>
                )}
              </div>
              {members.isPending && <Empty>{text("loading")}</Empty>}
              {members.data?.map((m) => {
                const leader =
                  m.member_type === "agent" && m.member_id === s.leader_id;
                const state = status.data?.members.find(
                  (x) =>
                    x.member_type === m.member_type &&
                    x.member_id === m.member_id,
                )?.status;
                return (
                  <article className="team-squad-member" key={m.id}>
                    <Avatar name={people.name(m.member_id)} />
                    <div className="team-squad-member-copy">
                      <strong>
                        {people.name(m.member_id)}{" "}
                        {leader && (
                          <span className="team-squad-leader">
                            <Crown size={12} />
                            {text("squadLeader")}
                          </span>
                        )}
                      </strong>
                      <small>
                        {text(
                          m.member_type === "agent"
                            ? "mentionAgent"
                            : "mentionMember",
                        )}
                        {state && ` · ${text(`squadState.${state}`)}`}
                      </small>
                      <p>
                        {m.role === "leader"
                          ? text("squadLeaderHint")
                          : m.role || text("noSquadRole")}
                      </p>
                    </div>
                    {canManage && (
                      <div className="team-actions">
                        <Action size="sm" onClick={() => setMemberEditor(m)}>
                          {text("squadRole")}
                        </Action>
                        {!leader && (
                          <Action size="sm" onClick={() => setRemove(m)}>
                            {text("remove")}
                          </Action>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
            <section className="team-squad-instructions">
              <div className="team-toolbar">
                <h2>{text("squadInstructions")}</h2>
                {canManage && (
                  <Action size="sm" onClick={() => setEdit(true)}>
                    {text("edit")}
                  </Action>
                )}
              </div>
              {s.instructions ? (
                <TeamMarkdown content={s.instructions} />
              ) : (
                <p className="team-squad-help">
                  {text("squadInstructionsHint")}
                </p>
              )}
              <div className="team-squad-context-note">
                <Crown size={16} />
                <p>{text("squadScopeHint")}</p>
              </div>
            </section>
          </div>
          {edit && (
            <SquadEditor
              squad={s}
              people={people}
              onClose={() => setEdit(false)}
              onSaved={() => setEdit(false)}
            />
          )}
          {memberEditor && (
            <MemberEditor
              squad={s}
              member={memberEditor === "new" ? undefined : memberEditor}
              members={members.data || []}
              people={people}
              onClose={() => setMemberEditor(null)}
            />
          )}
          {(archive || remove) && (
            <Modal
              className={archive ? "directory-archive-dialog" : undefined}
              title={text(archive ? "archiveSquad" : "removeSquadMember")}
              onClose={() => {
                if (!action.isPending) {
                  setArchive(false);
                  setRemove(null);
                }
              }}
            >
              <div className={archive ? "directory-archive-body" : undefined}>
                {archive ? <>
                  <p>{text("confirmArchiveName").replace("{name}", s.name)}</p>
                  <p className="directory-archive-help">{text("archiveSquadHint")}</p>
                </> : <p>{text("removeSquadMemberHint")} {remove ? people.name(remove.member_id) : ""}</p>}
                <Failure error={action.error} />
              </div>
              <div className={archive ? "directory-archive-footer" : "team-modal-actions"}>
                <Action
                  disabled={action.isPending}
                  onClick={() => {
                    setArchive(false);
                    setRemove(null);
                  }}
                >
                  {text("cancel")}
                </Action>
                <Action
                  primary
                  disabled={action.isPending}
                  onClick={() => action.mutate(archive ? "archive" : "remove")}
                >
                  {text(archive ? "confirmArchiveAgent" : "remove")}
                </Action>
              </div>
            </Modal>
          )}
        </>
      )}
    </>
  );
}

function MemberEditor({
  squad,
  member,
  members,
  people,
  onClose,
}: {
  squad: Squad;
  member?: SquadMember;
  members: SquadMember[];
  people: ReturnType<typeof useTeamPeople>;
  onClose: () => void;
}) {
  const [target, setTarget] = useState("");
  const [role, setRole] = useState(member?.role || "");
  const admin = people.role === "owner" || people.role === "admin";
  const options = [
    ...(people.agents.data || [])
      .filter(
        (a) =>
          !a.archived_at &&
          (!!a.runtime_id || a.system_key === "mobilework") &&
          (admin || people.allowed(a)),
      )
      .map((a) => ({
        value: `agent:${a.id}`,
        label: `${a.name} · ${text("mentionAgent")}`,
      })),
    ...(people.members.data || []).map((m) => ({
      value: `member:${m.user_id}`,
      label: `${m.name || m.email} · ${text("mentionMember")}`,
    })),
  ].filter(
    (o) => !members.some((m) => o.value === `${m.member_type}:${m.member_id}`),
  );
  const action = useTeamAction(async () => {
    if (member)
      await teamApi.updateSquadMemberRole(squad.id, {
        ...member,
        role: role.trim(),
      });
    else {
      const [member_type, member_id] = target.split(":");
      await teamApi.addSquadMember(squad.id, {
        member_type,
        member_id,
        role: role.trim(),
      });
    }
    onClose();
  });
  return (
    <Modal
      title={text(member ? "editSquadRole" : "addSquadMember")}
      onClose={() => {
        if (!action.isPending) onClose();
      }}
    >
      {member ? (
        <strong>{people.name(member.member_id)}</strong>
      ) : (
        <Field label={text("squadMember")}>
          <Picker
            label={text("chooseSquadMember")}
            value={target}
            options={options}
            onChange={setTarget}
            disabled={action.isPending}
          />
        </Field>
      )}
      <Field label={text("squadRole")}>
        <Textarea
          rows={3}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={action.isPending}
          placeholder={text("squadRoleHint")}
        />
      </Field>
      <Failure error={action.error} />
      <div className="team-modal-actions">
        <Action disabled={action.isPending} onClick={onClose}>
          {text("cancel")}
        </Action>
        <Action
          primary
          disabled={action.isPending || (!member && !target)}
          onClick={() => action.mutate()}
        >
          {text("save")}
        </Action>
      </div>
    </Modal>
  );
}
