import { RemoteHost } from "./remote-host";
import {
  settingsAgentLists,
  settingsRuntimeList,
  isWorkspaceShared,
  workspaceSharingUpdate,
} from "./settings-scope";
import { providerDisplayName } from "@multica/core/runtimes/display";
import { AgentDelete } from "./agent-delete";
import { AgentProbe } from "./agent-probe";
import type { AgentRuntime } from "@multica/core/types";
import { ModelPicker } from "./model-picker";
import { useState } from "react";
import { Cpu, Users, Bot, Plus } from "lucide-react";
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
import { enableTeamDaemon, readTeamDaemon, stopTeamDaemon } from "./desktop";
export function TeamSettings() {
  const { workspace, user } = useTeam();
  const demoAuth =
    sessionStorage.getItem("mobilework.demoPasswordAuth") === "1";
  const people = useTeamPeople();
  const runtimes = useTeamQuery(["runtimes"], () =>
    teamApi.listRuntimes({ workspace_id: workspace.id }),
  );
  const daemon = useTeamQuery(["daemon"], readTeamDaemon);
  const availableRuntimes = settingsRuntimeList(runtimes.data ?? [], user.id);
  const [agentTab, setAgentTab] = useState<"mine" | "team">("mine");
  const agentLists = settingsAgentLists(people.agents.data ?? [], {
    userId: user.id,
    role: people.role,
  });

  const endpointOwner = runtimes.data?.find(
    (r) => r.daemon_id === daemon.data?.daemonId,
  )?.owner_id;
  const ownerName = (id: string | null) =>
    people.members.data?.find((m) => m.user_id === id)?.name ||
    text("unknownOwner");
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
  const [shared, setShared] = useState(false);
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
        name,
        instructions,
        runtime_id: runtime,
        model: model.trim(),
        ...workspaceSharingUpdate(
          people.agents.data?.find((agent) => agent.id === editId),
          shared,
        ),
      };
      if (editId) await teamApi.updateAgent(editId, data);
      else await teamApi.createAgent(data);
    }
    setMode(null);
    setName("");
    setInstructions("");
  });
  const enable = useTeamAction(async () => {
    return enableTeamDaemon({ userId: user.id });
  });
  const stop = useTeamAction(stopTeamDaemon);
  const machines = new Map<string, AgentRuntime[]>();
  for (const runtime of availableRuntimes) {
    const key = runtime.daemon_id
      ? `${runtime.runtime_mode}:${runtime.daemon_id}`
      : `runtime:${runtime.id}`;
    const group = machines.get(key) ?? [];
    group.push(runtime);
    machines.set(key, group);
  }
  const localEnabled =
    daemon.data?.state === "running" ||
    daemon.data?.state === "restart_required" ||
    daemon.data?.state === "starting";
  return (
    <>
      <div className="team-toolbar">
        <div>
          <h1>{text("settings")}</h1>
          <p>{text("settingsHint")}</p>
        </div>
      </div>
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
      <section className="team-settings-section">
        <div className="team-toolbar">
          <h3>
            <Users size={18} />
            {text(workspace.kind === "personal" ? "wb.members" : "members")}
          </h3>
          {workspace.kind !== "personal" && (role === "owner" || role === "admin") && (
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
      <section className="team-settings-section">
        <div className="team-toolbar team-endpoint-toolbar">
          <h3>
            <Cpu size={18} />
            {text("executionEndpoints")}
          </h3>
          <div className="team-actions team-endpoint-actions">
            <RemoteHost />
            {localEnabled ? (
              <Action disabled={stop.isPending} onClick={() => stop.mutate()}>
                {text("stopLocal")}
              </Action>
            ) : (
              <Action
                primary
                disabled={
                  enable.isPending ||
                  stop.isPending ||
                  daemon.isPending ||
                  daemon.data?.state === "unavailable"
                }
                onClick={() => enable.mutate()}
              >
                {text(enable.isPending ? "enabling" : "enableLocal")}
              </Action>
            )}
          </div>
        </div>
        <p>{text("runtimeHint")}</p>
        <Failure error={enable.error || daemon.error || stop.error} />
        {localEnabled && (
          <p role="status">
            {text(
              daemon.data?.state === "starting" ? "enabling" : "daemonStarted",
            )}
          </p>
        )}
        {daemon.data?.state === "restart_required" && (
          <p role="status">{text("modelReenableRequired")}</p>
        )}
        {endpointMismatch && (
          <p role="alert" className="team-error">
            {text("endpointMismatch")} · {text("endpointOwner")}：
            {ownerName(endpointOwner)}
          </p>
        )}
        {localEnabled && (
          <p className="team-runtime-hint">{text("nativeAgentHint")}</p>
        )}
        {runtimes.isPending || daemon.isPending ? (
          <Empty>{text("loading")}</Empty>
        ) : (
          !runtimes.isError &&
          !daemon.isError &&
          !availableRuntimes.length && <Empty>{text("noRuntimes")}</Empty>
        )}
        {[...machines].map(([id, tools]) => {
          const first = tools[0];
          const sharedName =
            first.custom_name &&
            tools.every((r) => r.custom_name === first.custom_name)
              ? first.custom_name
              : null;
          const hostname = first.name.match(/\(([^)]+)\)$/)?.[1];
          return (
            <details className="team-machine" key={id} open>
              <summary>
                <Cpu size={18} />
                <strong>
                  {sharedName ||
                    hostname ||
                    first.device_info ||
                    text("unknownMachine")}
                </strong>
                <small>
                  {ownerName(first.owner_id)} ·{" "}
                  {first.daemon_id === daemon.data?.daemonId
                    ? text("thisClient")
                    : text("otherEndpoint")}{" "}
                </small>
                <span className="team-spacer" />
                <span>{text("daemonConnection")}</span>
                <Status
                  value={
                    tools.some((r) => r.status === "online")
                      ? "online"
                      : "offline"
                  }
                />
                <small>{tools.length} CLI</small>
              </summary>
              {tools.map((r) => (
                <div className="team-setting-row team-cli-row" key={r.id}>
                  <span>
                    {r.custom_name && r.custom_name !== sharedName
                      ? r.custom_name
                      : r.name.replace(/\s+\([^)]+\)$/, "")}
                  </span>
                  <small>{r.provider}</small>
                  {r.status === "offline" &&
                    tools.some((other) => other.status === "online") && (
                      <small>{text("cliUnavailable")}</small>
                    )}
                </div>
              ))}
            </details>
          );
        })}
      </section>
      <section className="team-settings-section">
        <div className="team-toolbar">
          <h3>
            <Bot size={18} />
            {text("agentDirectory")}
          </h3>
          <Action
            onClick={() => {
              setEditId(null);
              setName("");
              setInstructions("");
              setRuntime("");
              setModel("");
              setShared(false);
              setMode("agent");
            }}
          >
            <Plus size={16} />
            {text("newAgent")}
          </Action>
        </div>
        <div
          className="team-agent-tabs"
          role="tablist"
          aria-label={text("agentDirectory")}
        >
          {(["mine", "team"] as const).filter(tab=>workspace.kind !== "personal" || tab === "mine").map((tab) => (
            <button
              key={tab}
              id={`agent-tab-${tab}`}
              role="tab"
              aria-selected={agentTab === tab}
              aria-controls="team-agent-panel"
              tabIndex={agentTab === tab ? 0 : -1}
              onClick={() => setAgentTab(tab)}
              onKeyDown={(event) => {
                if (workspace.kind === "personal") return;
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "mine"
                    : event.key === "End"
                      ? "team"
                      : tab === "mine"
                        ? "team"
                        : "mine";
                setAgentTab(next);
                document.getElementById(`agent-tab-${next}`)?.focus();
              }}
            >
              {text(tab === "mine" ? "myAgents" : "teamAgents")}{" "}
              <span>{agentLists[tab].length}</span>
            </button>
          ))}
        </div>
        <div
          id="team-agent-panel"
          role="tabpanel"
          aria-labelledby={`agent-tab-${agentTab}`}
        >
          <p className="team-agent-tab-hint">
            {text(agentTab === "mine" ? "myAgentsHint" : "teamAgentsHint")}
          </p>
          {people.agents.isPending ? (
            <Empty>{text("loading")}</Empty>
          ) : (
            !people.agents.isError &&
            !agentLists[agentTab].length && (
              <Empty>
                {text(agentTab === "mine" ? "noMyAgents" : "noTeamAgents")}
              </Empty>
            )
          )}
          {agentLists[agentTab].map((a) => {
            const boundRuntime = runtimes.data?.find(
              (r) => r.id === a.runtime_id,
            );
            return (
              <div className="team-setting-row team-agent-row" key={a.id}>
                <Avatar name={a.name} />
                <div className="team-agent-copy">
                  <strong>{a.name}</strong>
                  <dl className="team-agent-configuration">
                    <div>
                      <dt>{text("agentType")}</dt>
                      <dd>
                        {boundRuntime?.provider
                          ? providerDisplayName(boundRuntime.provider)
                          : text(
                              runtimes.isPending
                                ? "loading"
                                : "agentTypeUnavailable",
                            )}
                      </dd>
                    </div>
                    <div>
                      <dt>{text("configuredModel")}</dt>
                      <dd>{a.model.trim() || text("modelDefault")}</dd>
                    </div>
                  </dl>
                  <small>
                    {text("agentOwner")} · {ownerName(a.owner_id)}{" "}
                    <span className="team-agent-access">
                      {text(
                        a.permission_mode === "public_to"
                          ? "agentShared"
                          : "agentPrivate",
                      )}
                    </span>
                  </small>
                  {(a.description || a.instructions) && (
                    <small className="team-agent-description">
                      {a.description || a.instructions}
                    </small>
                  )}
                </div>
                <div className="team-agent-actions">
                  <Status
                    value={
                      (boundRuntime?.status ?? a.runtime_availability) ===
                      "offline"
                        ? "offline"
                        : a.status
                    }
                  />
                  {a.owner_id === user.id && (
                    <AgentProbe
                      key={`${a.id}:${a.runtime_id}:${a.model}`}
                      agent={a}
                      endpointHint={
                        boundRuntime?.daemon_id === daemon.data?.daemonId && endpointMismatch ? "endpointMismatch" : undefined
                      }
                      remote={boundRuntime?.daemon_id !== daemon.data?.daemonId}
                      provider={boundRuntime?.provider}
                    >
                      <Action
                        onClick={() => {
                          setEditId(a.id);
                          setName(a.name);
                          setInstructions(a.instructions || "");
                          setRuntime(a.runtime_id || "");
                          setModel(a.model || "");
                          setShared(isWorkspaceShared(a));
                          setMode("agent");
                        }}
                      >
                        {text("editAgent")}
                      </Action>
                      {!a.system_key && <AgentDelete agent={a} />}
                    </AgentProbe>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
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
              <Field label={text("instructions")}>
                <Textarea
                  rows={6}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </Field>
              {workspace.kind !== "personal" && <label className="team-checkbox">
                <input
                  type="checkbox"
                  checked={shared}
                  onChange={(e) => setShared(e.target.checked)}
                />
                {text("shareAgent")}
              </label>}
            </>
          )}
          <Failure error={save.error} />
          <Action
            primary
            disabled={
              save.isPending ||
              (mode === "agent" ? !name.trim() || !runtime : !email)
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
