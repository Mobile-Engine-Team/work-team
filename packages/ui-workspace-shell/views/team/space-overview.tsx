import {useWorkModelAvailability} from "../workbench/model-availability";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bot,
  Check,
  Copy,
  FolderKanban,
  Info,
  MonitorCog,
  Pencil,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useState } from "react";
import { teamApi, useTeam, useTeamQuery } from "./client";
import { Failure } from "./ui";
import { TeamSettings } from "./team-settings";
import { useTeamPeople } from "./tasks";
import { settingsAgentLists, settingsRuntimeList } from "./settings-scope";
import "./space-overview.css";
function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="space-metric">
      <span>
        <Icon size={17} />
      </span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
      <em>{hint}</em>
    </div>
  );
}
export function SpaceOverview({
  edit,
  members,
  invite,
}: {
  edit: () => void;
  members: () => void;
  invite: () => void;
}) {
  const workReady=useWorkModelAvailability();
  const { workspace: team, user } = useTeam(),
    people = useTeamPeople();
  const runtimes = useTeamQuery(["runtimes"], () =>
    teamApi.listRuntimes({ workspace_id: team.id }),
  );
  const projects = useTeamQuery(["projects"], () => teamApi.listProjects());
  const allowed = settingsAgentLists(people.agents.data || [], {
    userId: user.id,
    role: people.role,
  });
  const agents = Array.from(
    new Map(
      [
        ...allowed.mine,
        ...allowed.team,
        ...(people.agents.data || []).filter(
          (a) => a.system_key === "mobilework",
        ),
      ].map((a) => [a.id, a]),
    ).values(),
  );
  const squads = (people.squads.data || []).filter((s) => !s.archived_at);
  const machines = new Map<string, boolean>();
  for (const runtime of settingsRuntimeList(runtimes.data || [], user.id)) {
    const key = runtime.daemon_id || runtime.id;
    machines.set(key, machines.get(key) || runtime.status === "online");
  }
  const activeAgents = agents.filter(
    (a) =>
      a.system_key === "mobilework" ? workReady === true :
      (runtimes.data?.find((r) => r.id === a.runtime_id)?.status ||
        a.runtime_availability) === "online",
  ).length;
  const onlineMachines = [...machines.values()].filter(Boolean).length;
  const manage = people.role === "owner" || people.role === "admin";
  const role =
    people.role === "owner"
      ? "所有者"
      : people.role === "admin"
        ? "管理员"
        : "成员";
  const memberCount = people.members.data?.length ?? "—";
  const [copyState, setCopyState] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(team.id);
      setCopyState("已复制");
    } catch {
      setCopyState("复制失败，可选择空间标识手动复制");
    }
  }
  return (
    <div className="space-page">
      <header className="design-module-header space-module-header">
        <div>
          <h1>协作空间</h1>
          <p>查看当前空间的成员、共享资料与运行环境。</p>
        </div>
        <span className="space-role">
          <ShieldCheck size={14} />
          {role}
        </span>
      </header>
      <div className="space-body">
        <Failure
          error={
            people.members.error ||
            people.agents.error ||
            people.squads.error ||
            runtimes.error ||
            projects.error
          }
        />
        {copyState && <p role="status">{copyState}</p>}
        <section className="space-identity">
          <div className="space-avatar" data-tone={"blue"}>
            {team.avatar_url ? (
              <img src={team.avatar_url} alt="" />
            ) : (
              team.name.slice(0, 1)
            )}
          </div>
          <div className="space-identity-copy">
            <div>
              <h2>{team.name}</h2>
              <span>{role}</span>
            </div>
            <p>
              {team.description ||
                "让伙伴与智能体共享目标、上下文与执行环境，一起把事情向前推进。"}
            </p>
          </div>
          <button className="space-secondary-action" onClick={edit}>
            <Pencil size={15} />
            {manage ? "编辑空间资料" : "查看空间资料"}
          </button>
        </section>
        <div className="space-metrics">
          <Metric
            icon={Users}
            label="协作成员"
            value={memberCount}
            hint={user.name + " 当前在线"}
          />
          <Metric
            icon={Bot}
            label="智能体"
            value={people.agents.data ? agents.length : "—"}
            hint={activeAgents + " 个在线"}
          />
          <Metric
            icon={Users}
            label="小队"
            value={people.squads.data ? squads.length : "—"}
            hint="按目标组织协作"
          />
          <Metric
            icon={MonitorCog}
            label="运行机器"
            value={runtimes.data ? machines.size : "—"}
            hint={onlineMachines + " 台在线"}
          />
        </div>
        <div className="space-info-grid">
          <section className="space-panel">
            <header>
              <span className="space-panel-icon">
                <Info size={17} />
              </span>
              <div>
                <h3>空间资料</h3>
                <p>智能体和成员共同使用的协作背景。</p>
              </div>
            </header>
            <dl className="space-facts">
              <div>
                <dt>空间名称</dt>
                <dd>{team.name}</dd>
              </div>
              <div>
                <dt>空间标识</dt>
                <dd>
                  <code>{team.id}</code>
                  <button
                    aria-label="复制空间标识"
                    title="复制空间标识"
                    onClick={copy}
                  >
                    {copyState === "已复制" ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </dd>
              </div>
              <div>
                <dt>智能体上下文</dt>
                <dd>
                  {team.context ||
                    "尚未设置。可补充业务背景、目标用户与团队协作约定。"}
                </dd>
              </div>
            </dl>
            <button className="space-text-action" onClick={edit}>
              管理空间资料
              <ArrowUpRight size={14} />
            </button>
          </section>
          <section className="space-panel">
            <header>
              <span className="space-panel-icon space-panel-icon-green">
                <Users size={17} />
              </span>
              <div>
                <h3>协作构成</h3>
                <p>人和智能体在同一空间内共享任务与会话。</p>
              </div>
            </header>
            <div className="space-composition">
              <div>
                <span>
                  <Users size={15} />
                </span>
                <strong>{memberCount} 位成员</strong>
                <small>可参与会话、任务与项目</small>
              </div>
              <div>
                <span>
                  <Bot size={15} />
                </span>
                <strong>{agents.length} 个智能体</strong>
                <small>其中 {activeAgents} 个当前在线</small>
              </div>
              <div>
                <span>
                  <FolderKanban size={15} />
                </span>
                <strong>{projects.data?.total ?? "—"} 个项目</strong>
                <small>承载协作成果与执行记录</small>
              </div>
            </div>
            <div className="space-panel-actions">
              <button className="space-text-action" onClick={members}>
                管理成员
                <ArrowUpRight size={14} />
              </button>
              {manage && (
                <button className="space-text-action" onClick={invite}>
                  邀请成员
                  <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          </section>
        </div>
        <section
          className="space-runtime"
          aria-labelledby="space-runtime-title"
        >
          <header>
            <div className="space-runtime-title">
              <span>
                <Server size={18} />
              </span>
              <div>
                <h2 id="space-runtime-title">运行时</h2>
                <p>查看本机执行端与远程机器的连接状态。</p>
              </div>
            </div>
            <span className="space-runtime-status">
              <i />
              {onlineMachines} 台机器在线
            </span>
          </header>
          <div className="space-runtime-frame">
            <TeamSettings section="runtime" embedded />
          </div>
        </section>
      </div>
    </div>
  );
}
