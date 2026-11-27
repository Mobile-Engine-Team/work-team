import {useWorkModelAvailability} from "../workbench/model-availability";
import { AssignedWork, ObjectLinks } from "./assigned-work";
import { WorkspaceAvatar } from "./workspace-avatar";
import { RuntimeDirectory } from "./runtime-directory";
import { Directory, type DirectoryItem } from "./directory";
import { AgentEnvironment } from "./agent-environment";
import { ChatEntry } from "./agent-chat";
import { useSearchParams } from "react-router-dom";
import {
  settingsAgentLists,
  settingsRuntimeList,
  isWorkspaceShared,
} from "./settings-scope";
import { providerDisplayName } from "@multica/core/runtimes/display";
import { AgentDelete } from "./agent-delete";
import { AgentProbe } from "./agent-probe";
import type { Agent, AgentRuntime } from "@multica/core/types";
import { ModelPicker } from "./model-picker";
import { useState } from "react";
import { Cpu, Users, Bot, Plus } from "../icons";
import { teamApi, text, useTeam, useTeamQuery, useTeamAction } from "./client";
import {
  Action,
  Empty,
  Field,
  Input,
  Textarea,
  Picker,
  Modal,
  Failure,
  Status,
  Avatar,
} from "./ui";
import { useTeamPeople } from "./tasks";
import { readTeamDaemon } from "./desktop";
export function TeamSettings({
  section,
  embedded = false,
}: {
  section: "agents" | "space" | "runtime";
  embedded?: boolean;
}) {
  const { workspace, user } = useTeam();
  const workReady=useWorkModelAvailability(section === "agents");
  const [params, setParams] = useSearchParams();
  const [showProperties, setShowProperties] = useState(true);
  const [avatar, setAvatar] = useState(""),
    [loadingAvatar, setLoadingAvatar] = useState(false);
  const [concurrency, setConcurrency] = useState(6);
  const [starters, setStarters] = useState<{ label: string; prompt: string }[]>(
    [],
  );
  const selected = params.get("agent");
  const scope = params.get("scope") || "全部智能体";
  const showArchived = section === "agents" && scope === "已归档";
  const archive = useTeamQuery(
    ["agents", "archived"],
    () =>
      teamApi.listAgents({
        workspace_id: workspace.id,
        include_archived: true,
      }),
    showArchived,
  );
  const restore = useTeamAction((id: string) => teamApi.restoreAgent(id));
  const demoAuth =
    sessionStorage.getItem("mobilework.demoPasswordAuth") === "1";
  const people = useTeamPeople();
  const runtimes = useTeamQuery(["runtimes"], () =>
    teamApi.listRuntimes({ workspace_id: workspace.id }),
  );
  const daemon = useTeamQuery(["daemon"], readTeamDaemon);
  const availableRuntimes = settingsRuntimeList(runtimes.data ?? [], user.id);
  const agentLists = settingsAgentLists(
    (people.agents.data ?? []).filter((a) => a.system_key !== "mobilework"),
    {
      userId: user.id,
      role: people.role,
    },
  );

  const endpointOwner = runtimes.data?.find(
    (r) => r.daemon_id === daemon.data?.daemonId,
  )?.owner_id;
  const accessible = new Set(
    [...agentLists.mine, ...agentLists.team].map((a) => a.id),
  );
  const agents = showArchived
    ? (archive.data || []).filter(
        (a) => a.archived_at && a.owner_id === user.id,
      )
    : (people.agents.data || []).filter(
        (a) =>
          !a.archived_at &&
          (accessible.has(a.id) || a.system_key === "mobilework"),
      );
  const current = agents.find((a) => a.id === selected);
  const ownerName = (id: string | null) =>
    people.members.data?.find((m) => m.user_id === id)?.name ||
    text("unknownOwner");
  const runtimeOf = (a: Agent) =>
    runtimes.data?.find((r) => r.id === a.runtime_id);
  const squads=(people.squads.data||[]).filter(s=>!s.archived_at);
  const partial=squads.filter(s=>(s.member_count||0)>(s.member_preview?.length||0));
  const memberships=useTeamQuery(["squads","directory-members",partial.map(s=>[s.id,s.updated_at])],async()=>{
    const groups=await Promise.all(partial.map(async s=>[s.id,await teamApi.listSquadMembers(s.id)] as const));
    return Object.fromEntries(groups);
  },section==="agents"&&partial.length>0);
  const squadCount=(agentId:string)=>partial.length&&!memberships.data?undefined:squads.filter(s=>
    s.leader_id===agentId||(memberships.data?.[s.id]||s.member_preview)?.some(m=>m.member_type==="agent"&&m.member_id===agentId)
  ).length;
  const entries: DirectoryItem[] = agents.map((a) => {
    const rt = runtimeOf(a),
      builtin = a.system_key === "mobilework";
    const online =
      builtin ? workReady : (rt?.status || a.runtime_availability) === "online";
    return {
      id: a.id,
      squadCount:squadCount(a.id),
      name: a.name,
      avatar: a.avatar_url,
      description: a.description,
      owner: builtin ? "系统" : ownerName(a.owner_id),
      mine: !builtin && a.owner_id === user.id,
      first: builtin
        ? "Work 服务"
        : rt?.custom_name || rt?.name || "未绑定执行端",
      second: a.model || text("modelDefault"),
      status: a.archived_at ? "已归档" : online === undefined ? "状态未知" : online ? "在线" : "离线",
      archived: !!a.archived_at,
      builtin,
    };
  });
  const here = (id?: string, group = scope) =>
    setParams({ view: "agents", scope: group, ...(id ? { agent: id } : {}) });
  const newAgent = () => {
    setAvatar("");
    setConcurrency(6);
    setStarters([]);
    setEditId(null);
    setName("");
    setInstructions("");
    setRuntime("");
    setModel("");
    setAccess("private");
    setGrants([]);
    setDescription("");
    setMode("agent");
  };
  const endpointMismatch = !!endpointOwner && endpointOwner !== user.id;
  const runtimeLabel = (r: AgentRuntime) =>
    `${r.custom_name || r.name} · ${ownerName(r.owner_id)} · ${r.daemon_id === daemon.data?.daemonId ? text("thisClient") : text("otherEndpoint")} · ${text(`status.${r.status}`)}`;
  const [editId, setEditId] = useState<string | null>(null);
  const [mode, setMode] = useState<"agent" | "invite" | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [runtime, setRuntime] = useState("");
  const [model, setModel] = useState("");
  const selectedRuntime = runtimes.data?.find((item) => item.id === runtime);
  const [email, setEmail] = useState("");
  const [access, setAccess] = useState("private");
  const [grants, setGrants] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const openAgent = (agent: Agent, copy = false) => {
    setAvatar(agent.avatar_url || "");
    setConcurrency(agent.max_concurrent_tasks || 6);
    setStarters(agent.conversation_starters || []);
    setEditId(copy ? null : agent.id);
    setName(agent.name + (copy ? " 副本" : ""));
    setInstructions(agent.instructions || "");
    setDescription(agent.description || "");
    setRuntime(agent.runtime_id || "");
    setModel(agent.model || "");
    setAccess(
      copy
        ? "private"
        : isWorkspaceShared(agent)
          ? "workspace"
          : agent.permission_mode === "public_to"
            ? "members"
            : "private",
    );
    setGrants(
      copy
        ? []
        : agent.invocation_targets.flatMap((t) =>
            t.target_type === "member" && t.target_id ? [t.target_id] : [],
          ),
    );
    setMode("agent");
  };
  const role = people.members.data?.find((m) => m.user_id === user.id)?.role;
  const invites = useTeamQuery(
    ["invitations"],
    () => teamApi.listWorkspaceInvitations(workspace.id),
    role === "owner" || role === "admin",
  );
  const [invited, setInvited] = useState("");
  const save = useTeamAction(async () => {
    if (mode === "invite") {
      const inviteEmail =
        demoAuth && !email.includes("@")
          ? `${email.trim().toLowerCase()}@demo.mobilework.invalid`
          : email;
      await teamApi.createMember(workspace.id, {
        email: inviteEmail,
        role: "member",
      });
      setInvited(email);
    } else {
      const data = {
        avatar_url: avatar,
        max_concurrent_tasks: concurrency,
        conversation_starters: starters,
        name,
        instructions,
        description: description.trim(),
        ...(runtime ? { runtime_id: runtime } : {}),
        model: model.trim(),
        permission_mode:
          access === "private" ? ("private" as const) : ("public_to" as const),
        invocation_targets:
          access === "workspace"
            ? [{ target_type: "workspace" as const }]
            : access === "members"
              ? grants.map((target_id) => ({
                  target_type: "member" as const,
                  target_id,
                }))
              : [],
      };
      if (editId) await teamApi.updateAgent(editId, data);
      else await teamApi.createAgent({ ...data, runtime_id: runtime });
    }
    setMode(null);
    setName("");
    setInstructions("");
  });
  return (
    <>
      {!embedded && section !== "agents" && (
        <div className="team-toolbar">
          <div>
            <h1>{section === "space" ? "协作空间" : "运行时"}</h1>
            {section === "space" && (
              <p>
                {workspace.name} · {workspace.slug}
              </p>
            )}
          </div>
        </div>
      )}
      <Failure
        error={people.agents.error || people.members.error || runtimes.error}
        retry={() => {
          void people.agents.refetch();
          void people.members.refetch();
          void runtimes.refetch();
        }}
      />
      {invited && (
        <p role="status">
          {text("invitationSent")} · {invited}
        </p>
      )}
      {section === "space" && (
        <section className="team-settings-section">
          <div className="team-toolbar">
            <h3>
              <Users size={18} />
              {text(workspace.kind === "personal" ? "wb.members" : "members")}
            </h3>
            {workspace.kind !== "personal" &&
              (role === "owner" || role === "admin") && (
                <Action onClick={() => setMode("invite")}>
                  <Plus size={16} />
                  {text("invite")}
                </Action>
              )}
          </div>
          <Failure error={invites.error} />
          {invites.data
            ?.filter((i) => i.status === "pending")
            .map((i) => (
              <div className="team-setting-row" key={i.id}>
                <span>{i.invitee_email}</span>
                <span className="team-spacer" />
                <span>{text("invitationPending")}</span>
              </div>
            ))}
          {people.members.data?.map((m) => (
            <div className="team-setting-row" key={m.id}>
              <Avatar name={m.name} />
              <div>
                <strong>{m.name || m.email}</strong>
                <small>{m.email}</small>
              </div>
              <span className="team-spacer" />
              <span>{text(`role.${m.role}`)}</span>
            </div>
          ))}
        </section>
      )}
      {section === "runtime" && <RuntimeDirectory runtimes={availableRuntimes} agents={agents}
        ownerName={ownerName} manage={role==="owner" || role==="admin"} loading={runtimes.isPending}/>}
      {section === "agents" && (
        <>
          <Failure error={archive.error || restore.error} />
          {!selected ? (
            <Directory
              kind="智能体"
              items={[...entries].sort((a,b)=>Number(!!a.builtin)-Number(!!b.builtin))}
              scope={scope}
              onScope={(v) => here(undefined, v)}
              onCreate={newAgent}
              onOpen={(id) => here(id)}
              loading={
                showArchived ? archive.isPending : people.agents.isPending
              }
            />
          ) : !current ? (
            <div>
              <Action onClick={() => here()}>返回智能体</Action>
              <Empty>
                {people.agents.isPending || (showArchived && archive.isPending)
                  ? "加载中…"
                  : "未找到智能体"}
              </Empty>
            </div>
          ) : (
            <section className="directory-detail">
              <div className="team-toolbar">
                <Action onClick={() => here()}>← 智能体</Action>
                <span>{current.name}</span>
                <span className="team-spacer" />
                <ObjectLinks id={current.id} />
                <Action onClick={() => setShowProperties(!showProperties)}>
                  {showProperties ? "隐藏属性" : "显示属性"}
                </Action>
              </div>
              <div
                className="directory-detail-layout"
                style={
                  showProperties ? undefined : { gridTemplateColumns: "1fr" }
                }
              >
                <main>
                  <div className="directory-card-top">
                    <b className="directory-icon">
                      {current.avatar_url ? (
                        <img
                          width={24}
                          height={24}
                          src={current.avatar_url}
                          alt=""
                        />
                      ) : (
                        <Bot size={24} />
                      )}
                    </b>
                    <h1>{current.name}</h1>
                  </div>
                  <p>{current.description || "尚未添加描述"}</p>
                  {current.archived_at ? (
                    <Action
                      disabled={restore.isPending}
                      onClick={() =>
                        restore.mutate(current.id, {
                          onSuccess: () => here(undefined, "全部智能体"),
                        })
                      }
                    >
                      恢复
                    </Action>
                  ) : (
                    <>
                      <div className="team-actions">
                        {current.system_key === "mobilework" ? (
                          <Action
                            onClick={() =>
                              setParams({ view: "workbench", from: "agent" })
                            }
                          >
                            发起对话
                          </Action>
                        ) : (
                          <ChatEntry agent={current.id} title={current.name} />
                        )}
                        <Action
                          onClick={() =>
                            setParams({
                              view: "tasks",
                              create: "1",
                              owner: "agent:" + current.id,
                            })
                          }
                        >
                          分配工作
                        </Action>
                      </div>
                      <AssignedWork key={current.id} id={current.id} />
                    </>
                  )}
                </main>
                {showProperties && (
                  <aside>
                    <h2>属性</h2>
                    <dl>
                      <dt>状态</dt>
                      <dd>
                        {entries.find((i) => i.id === current.id)?.status}
                      </dd>
                      <dt>所有者</dt>
                      <dd>
                        {current.system_key === "mobilework"
                          ? "系统"
                          : ownerName(current.owner_id)}
                      </dd>
                      <dt>运行时</dt>
                      <dd>{entries.find((i) => i.id === current.id)?.first}</dd>
                      <dt>模型</dt>
                      <dd>{current.model || text("modelDefault")}</dd>
                      <dt>访问权限</dt>
                      <dd>
                        {current.system_key === "mobilework" ||
                        isWorkspaceShared(current)
                          ? "整个工作区"
                          : current.permission_mode === "public_to"
                            ? "指定成员"
                            : "仅自己"}
                      </dd>
                    </dl>
                    {!current.archived_at &&
                      !current.system_key &&
                      current.owner_id === user.id && (
                        <AgentProbe
                          agent={current}
                          endpointHint={
                            runtimeOf(current)?.daemon_id ===
                              daemon.data?.daemonId && endpointMismatch
                              ? "endpointMismatch"
                              : undefined
                          }
                          remote={
                            runtimeOf(current)?.daemon_id !==
                            daemon.data?.daemonId
                          }
                          provider={runtimeOf(current)?.provider}
                        >
                          <Action onClick={() => openAgent(current)}>
                            {text("editAgent")}
                          </Action>
                          <AgentEnvironment agent={current} />
                          <Action onClick={() => openAgent(current, true)}>
                            复制智能体
                          </Action>
                          <AgentDelete
                            agent={current}
                            onArchived={() => here(undefined, "已归档")}
                          />
                        </AgentProbe>
                      )}
                  </aside>
                )}
              </div>
            </section>
          )}
        </>
      )}
      {mode && (
        <Modal
          title={text(
            mode === "agent" ? (editId ? "editAgent" : "newAgent") : "invite",
          )}
          onClose={() => setMode(null)}
        >
          {mode === "invite" ? (
            <Field label={text(demoAuth ? "demoUsername" : "email")}>
              <Input
                type={demoAuth ? "text" : "email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          ) : (
            <>
              <WorkspaceAvatar
                label="智能体头像"
                name={name}
                value={avatar}
                onChange={setAvatar}
                reading={loadingAvatar}
                setReading={setLoadingAvatar}
              />
              <Field label={text("name")}>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label={text("runtime")}>
                <Picker
                  label={text("chooseRuntime")}
                  value={runtime}
                  options={[
                    ...availableRuntimes.map((r) => ({
                      value: r.id,
                      label: runtimeLabel(r),
                      disabled: r.status !== "online" && r.id !== runtime,
                    })),
                    ...(editId &&
                    runtime &&
                    !availableRuntimes.some((r) => r.id === runtime)
                      ? [
                          {
                            value: runtime,
                            label: text("boundOtherEndpoint"),
                            disabled: true,
                          },
                        ]
                      : []),
                  ]}
                  onChange={(id) => {
                    setRuntime(id);
                    setModel("");
                  }}
                />
              </Field>
              {!availableRuntimes.length && <p>{text("enableFirst")}</p>}
              <div className="team-field">
                <span>{text("model")}</span>
                <ModelPicker
                  key={runtime}
                  runtimeId={runtime}
                  online={selectedRuntime?.status === "online"}
                  provider={selectedRuntime?.provider}
                  local={
                    !!daemon.data?.daemonId &&
                    selectedRuntime?.daemon_id === daemon.data.daemonId &&
                    selectedRuntime?.owner_id === user.id
                  }
                  value={model}
                  onChange={setModel}
                />
              </div>
              <Field label="描述">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field label={text("instructions")}>
                <Textarea
                  rows={6}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </Field>
              <Field label="并发任务数">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                />
              </Field>
              <fieldset>
                <legend>对话开场</legend>
                {starters.map((v, i) => (
                  <div key={i} className="team-field">
                    <Input
                      aria-label={"开场名称 " + (i + 1)}
                      maxLength={80}
                      value={v.label}
                      onChange={(e) =>
                        setStarters(
                          starters.map((s, j) =>
                            i === j ? { ...s, label: e.target.value } : s,
                          ),
                        )
                      }
                    />
                    <Textarea
                      aria-label={"开场提示 " + (i + 1)}
                      maxLength={4000}
                      value={v.prompt}
                      onChange={(e) =>
                        setStarters(
                          starters.map((s, j) =>
                            i === j ? { ...s, prompt: e.target.value } : s,
                          ),
                        )
                      }
                    />
                    <Action
                      onClick={() =>
                        setStarters(starters.filter((_, j) => j !== i))
                      }
                    >
                      移除开场
                    </Action>
                  </div>
                ))}
                {starters.length < 3 && (
                  <Action
                    onClick={() =>
                      setStarters([...starters, { label: "", prompt: "" }])
                    }
                  >
                    添加对话开场
                  </Action>
                )}
              </fieldset>
              {workspace.kind !== "personal" && (
                <>
                  <Field label="访问范围">
                    <Picker
                      label="访问范围"
                      value={access}
                      onChange={setAccess}
                      options={[
                        { value: "private", label: "仅自己" },
                        { value: "workspace", label: "整个协作空间" },
                        { value: "members", label: "指定成员" },
                      ]}
                    />
                  </Field>
                  {access === "members" && (
                    <fieldset>
                      <legend>可调用成员</legend>
                      {people.members.data
                        ?.filter((m) => m.user_id !== user.id)
                        .map((m) => (
                          <label className="team-checkbox" key={m.user_id}>
                            <input
                              type="checkbox"
                              checked={grants.includes(m.user_id)}
                              onChange={(e) =>
                                setGrants(
                                  e.target.checked
                                    ? [...grants, m.user_id]
                                    : grants.filter((id) => id !== m.user_id),
                                )
                              }
                            />
                            {m.name || m.email}
                          </label>
                        ))}
                      {!grants.length && <p>请选择至少一位成员</p>}
                    </fieldset>
                  )}
                </>
              )}
            </>
          )}
          <Failure error={save.error} />
          <Action
            primary
            disabled={
              save.isPending ||
              (mode === "agent"
                ? !name.trim() ||
                  loadingAvatar ||
                  !Number.isInteger(concurrency) ||
                  concurrency < 1 ||
                  concurrency > 50 ||
                  starters.some((s) => !s.label.trim() || !s.prompt.trim()) ||
                  (!runtime && !editId) ||
                  (access === "members" && !grants.length)
                : !email)
            }
            onClick={() => save.mutate()}
          >
            {text("save")}
          </Action>
        </Modal>
      )}
    </>
  );
}
