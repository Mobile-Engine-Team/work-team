import { useEffect, useRef, useState } from "react";
import { ApiError } from "@multica/core/api";
import { RuntimeAccessRevocationPlanSchema } from "@multica/core/api/schemas";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { request } from "../workbench/api";
import { useSearchParams } from "react-router-dom";
import { SquareTerminal, Bot, ChevronRight, MoreHorizontal, RefreshCw, ScrollText, Square, Cpu, Laptop, PanelRight, Plus, Server, Wifi, WifiOff } from "../icons";
import type { Agent, AgentRuntime } from "@multica/core/types";
import { teamApi, text, useTeam, useTeamAction, useTeamQuery } from "./client";
import {
  enableTeamDaemon,
  readDaemonLog,
  readTeamDaemon,
  stopTeamDaemon,
} from "./desktop";
import { Action, Failure, Field, Input, Modal } from "./ui";
import { QoderConnection } from "./qoder-connection";
import { RuntimeProfileForm } from "./runtime-profiles";
import { RemoteHost } from "./remote-host";

import codexLogo from "../../../../mloop/design-v3/assets/runtime-providers/codex.svg?inline";
import claudeLogo from "../../../../mloop/design-v3/assets/runtime-providers/claude.svg?inline";
import cursorLogo from "../../../../mloop/design-v3/assets/runtime-providers/cursor.svg?inline";
import qoderLogo from "../../../../mloop/design-v3/assets/runtime-providers/qoder.svg?inline";

const providerLogos: Record<string,string>={codex:codexLogo,claude:claudeLogo,cursor:cursorLogo,qoder:qoderLogo};
function ProviderLogo({provider,size=16}:{provider:string;size?:number}) {
  const image=providerLogos[provider];
  return <span className="rt-provider-icon" role="img" aria-label={provider} title={provider}>
    {image ? <img src={image} alt="" width={size} height={size}/> : <Cpu size={size}/>}
  </span>;
}
type Runtime = AgentRuntime;
type Props = {
  runtimes: Runtime[];
  agents: Agent[];
  ownerName: (id: string | null) => string;
  manage: boolean;
  loading: boolean;
};
function machineKey(r: Runtime) {
  return r.daemon_id || r.id;
}
function machineName(rows: Runtime[]) {
  const first = rows[0];
  const shared =
    first.custom_name && rows.every((r) => r.custom_name === first.custom_name);
  return (
    (shared && first.custom_name) ||
    first.name.match(/\(([^)]+)\)$/)?.[1] ||
    first.device_info ||
    first.name
  );
}
function runtimeName(r: Runtime) {
  return r.name.replace(/\s+\([^)]+\)$/, "");
}
function ConnectionState({ online }: { online: boolean }) {
  const Icon = online ? Wifi : WifiOff;
  return (
    <span className={"rt-status" + (online ? "" : " rt-offline")}>
      <Icon size={13} /> {online ? "在线" : "离线"}
    </span>
  );
}
function RuntimeUsage({ id }: { id: string }) {
  const [days, setDays] = useState(7);
  const usage = useTeamQuery(["runtime-usage", id, days], () =>
    teamApi.getRuntimeUsage(id, {
      days,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  );
  return (
    <section className="rt-section">
      <header>
        <h3>用量</h3>
        <select
          aria-label="统计周期"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value="7">最近 7 天</option>
          <option value="30">最近 30 天</option>
        </select>
      </header>
      <Failure error={usage.error} />
      {usage.isPending ? (
        <p>正在读取用量…</p>
      ) : usage.data?.length ? (
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>模型</th>
              <th>输入 Token</th>
              <th>输出 Token</th>
            </tr>
          </thead>
          <tbody>
            {usage.data.map((v, i) => (
              <tr key={i}>
                <td>{v.date}</td>
                <td>{v.model}</td>
                <td>{v.input_tokens}</td>
                <td>{v.output_tokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        !usage.error && <p>此期间没有用量记录</p>
      )}
    </section>
  );
}
function RuntimeSettings({
  runtime,
  editable,
}: {
  runtime: Runtime;
  editable: boolean;
}) {
  const [limit, setLimit] = useState(
    String(runtime.max_concurrent_tasks ?? ""),
  );
  const [error, setError] = useState("");
  const saveLimit = useTeamAction(async () => {
    if (limit && (!/^\d+$/.test(limit) || +limit < 1 || +limit > 50)) {
      setError("请输入 1 至 50 的整数，或留空取消限制");
      return;
    }
    await teamApi.updateRuntime(runtime.id, {
      max_concurrent_tasks: limit ? Number(limit) : null,
    });
  });
  const [plan, setPlan] =
    useState<z.output<typeof RuntimeAccessRevocationPlanSchema>>();
  const share = useTeamAction(
    async (choice: "private" | "public" | "confirm") => {
      try {
        if (choice === "confirm") {
          if (!plan) return;
          await teamApi.revokeRuntimeWorkspaceAccess(
            runtime.id,
            plan.agents.map((a) => a.id),
            plan.activeTaskIds,
          );
        } else {
          await teamApi.updateRuntime(runtime.id, { visibility: choice });
        }
        setPlan(undefined);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const parsed = RuntimeAccessRevocationPlanSchema.safeParse(
            error.body,
          );
          if (parsed.success) {
            setPlan(parsed.data);
            return;
          }
        }
        throw error;
      }
    },
  );
  return (
    <>
      <section className="rt-section">
        <header>
          <h3>访问权限</h3>
        </header>
        <div className="rt-card">
          <Field label="可见性">
            <select
              aria-label="运行时可见性"
              disabled={!editable || share.isPending}
              value={runtime.visibility}
              onChange={(e) =>
                share.mutate(e.target.value === "public" ? "public" : "private")
              }
            >
              <option value="private">私有</option>
              <option value="public">工作区共享</option>
            </select>
          </Field>
          <small>
            {runtime.visibility === "public"
              ? "当前工作区成员可以使用此运行时。"
              : runtime.shared_with?.length
                ? "仅所有者与获授权成员可以使用此运行时。"
                : "仅所有者可以使用此运行时。"}
          </small>
        </div>
        {!plan && <Failure error={share.error} />}
      </section>
      <section className="rt-section">
        <header>
          <h3>并发</h3>
        </header>
        <div className="rt-card">
          <Field label="并发运行数">
            <Input
              aria-label="运行时并发上限"
              inputMode="numeric"
              placeholder="未限制"
              disabled={!editable}
              value={limit}
              onChange={(e) => {
                setLimit(e.target.value);
                setError("");
              }}
            />
          </Field>
          {editable && (
            <Action
              disabled={
                saveLimit.isPending ||
                limit === String(runtime.max_concurrent_tasks ?? "")
              }
              onClick={() => saveLimit.mutate()}
            >
              保存并发上限
            </Action>
          )}
          {error && <p role="alert">{error}</p>}
          <Failure error={saveLimit.error} />
        </div>
      </section>
      {plan && (
        <Modal title="收回运行时访问权限" onClose={() => setPlan(undefined)}>
          <p>
            收回共享会解除以下 {plan.agents.length} 个智能体的绑定，并中止{" "}
            {plan.activeTaskIds.length} 项活动任务。
          </p>
          <ul>
            {plan.agents.map((agent) => (
              <li key={agent.id}>{agent.name}</li>
            ))}
          </ul>
          <Failure error={share.error} />
          <div className="team-actions">
            <Action onClick={() => setPlan(undefined)}>取消</Action>
            <Action
              disabled={share.isPending}
              onClick={() => share.mutate("confirm")}
            >
              确认收回权限
            </Action>
          </div>
        </Modal>
      )}
    </>
  );
}

export function RuntimeDirectory({
  runtimes,
  agents,
  ownerName,
  manage,
  loading,
}: Props) {
  const { workspace, user } = useTeam();
  const profiles = useTeamQuery(["runtime-profiles"], () =>
    teamApi.listRuntimeProfiles(workspace.id),
  );
  const qoder = useTeamQuery(
    ["qoder"],
    () => teamApi.getQoderConnection(workspace.id),
    manage,
  );
  const [editProfile, setEditProfile] = useState<string | null>(null);
  const loads = useQuery({
    queryKey: ["team", workspace.id, "runtime-load", user.id],
    queryFn: () =>
      request(
        workspace.id,
        "/runtime-load",
        z.record(
          z.string(),
          z.object({ running: z.number(), assigned: z.number() }),
        ),
      ),
    refetchInterval: 5000,
  });
  function loadText(devices: Runtime[]) {
    if (!loads.data || loads.isError || devices.some((r) => !loads.data[r.id]))
      return "—";
    const running = devices.reduce((n, r) => n + loads.data[r.id].running, 0);
    const assigned = devices.reduce((n, r) => n + loads.data[r.id].assigned, 0);
    return (
      [running && `${running} 运行中`, assigned && `${assigned} 已分配`]
        .filter(Boolean)
        .join(" · ") || "全部空闲"
    );
  }
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function dismiss(event: PointerEvent | KeyboardEvent) {
      if (!menu.current?.open || document.querySelector('[role="dialog"]'))
        return;
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : event.target instanceof Node && !menu.current.contains(event.target)
      )
        menu.current.open = false;
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, []);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState("all");
  const [properties, setProperties] = useState(true);
  const [logsOpen, setLogsOpen] = useState(false);
  const [rename, setRename] = useState(false),
    [name, setName] = useState("");
  const daemon = useTeamQuery(["daemon"], readTeamDaemon);
  const control = useTeamAction(
    async (operation: "enable" | "stop" | "restart") => {
      try {
        if (operation !== "enable") await stopTeamDaemon();
        if (operation !== "stop") await enableTeamDaemon({ userId: user.id });
      } finally {
        await daemon.refetch();
      }
    },
  );
  const enabled = ["running", "restart_required", "starting"].includes(
    daemon.data?.state || "",
  );
  const groups = new Map<string, Runtime[]>();
  for (const runtime of runtimes) {
    if (runtime.provider === "qoder_cloud") continue;
    const key = machineKey(runtime);
    const list = groups.get(key);
    if (list) list.push(runtime);
    else groups.set(key, [runtime]);
  }
  const mid = params.get("machine"),
    rid = params.get("runtimeId");
  const group = mid ? groups.get(mid) : undefined;
  const selected = group?.find((r) => r.id === rid);
  const local = !!group && group[0].daemon_id === daemon.data?.daemonId;
  const cliVersion = group
    ?.map((r) => r.metadata?.cli_version)
    .find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const mine = !!group && group[0].owner_id === user.id;
  const logs = useTeamQuery(
    ["device-log", user.id, mid],
    () => readDaemonLog(mid!),
    logsOpen && local && mine,
  );
  const tab = params.get("runtimeTab") || "设置";
  function navigate(machine?: string, runtime?: string, tab?: string) {
    const next = new URLSearchParams(params);
    for (const [key, value] of [
      ["machine", machine],
      ["runtimeId", runtime],
      ["runtimeTab", tab],
    ]) {
      if (value) next.set(key!, value);
      else next.delete(key!);
    }
    setLogsOpen(false);
    setRename(false);
    setParams(next);
  }
  const renameMachine = useTeamAction(async () => {
    if (!group) return;
    await teamApi.updateRuntime(group[0].id, {
      custom_name: name.trim(),
      apply_to_machine: !!group[0].daemon_id,
    });
    setRename(false);
  });
  const visible = [...groups].filter(
    ([, rs]) =>
      filter === "all" ||
      rs.some((r) => r.status === "online") === (filter === "online"),
  );
  const bound = (rs: Runtime[]) =>
    agents.filter((a) => rs.some((r) => r.id === a.runtime_id));
  const config = runtimes.find((r) => r.provider === "qoder_cloud");
  function localAction(compact=false) {
    return (
      <Action
        disabled={
          daemon.isPending ||
          daemon.data?.state === "unavailable" ||
          control.isPending
        }
        aria-label={text(enabled ? "stopLocal" : "enableLocal")}
        onClick={() => control.mutate(enabled ? "stop" : "enable")}
      >
        {compact && enabled ? <><Square size={12}/>停止</> : text(enabled ? "stopLocal" : "enableLocal")}
      </Action>
    );
  }
  return (
    <section className="rt-surface mw-runtime" aria-label="运行时目录">
      <header className="rt-toolbar">
        {mid ? (
          <>
            <button onClick={() => navigate()}>运行时</button>
            <ChevronRight size={13} />
            {group && (
              <button onClick={() => navigate(mid)}>
                <Laptop size={14} />
                {machineName(group)}
              </button>
            )}
            {selected && (
              <>
                <ChevronRight size={13} />
                {runtimeName(selected)}
              </>
            )}
          </>
        ) : (
          <><Server size={16}/><select
            aria-label="筛选运行时"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">全部运行时</option>
            <option value="online">在线</option>
            <option value="offline">离线</option>
          </select></>
        )}
        <div className="rt-tools">
          {!mid ? (
            <details ref={menu}>
              <summary aria-label="添加运行时">
                <Plus size={17} />
              </summary>
              <div className="rt-menu">
                {localAction()}
                <RemoteHost />
                {manage && (
                  <Action onClick={() => setEditProfile("new")}>
                    添加自定义运行时
                  </Action>
                )}
              </div>
            </details>
          ) : (
            <>
              {group && !selected && mine && (
                <details ref={menu}><summary aria-label="机器操作"><MoreHorizontal size={16}/></summary><div className="rt-menu">
                  <button onClick={()=>{if(menu.current) menu.current.open=false;setName(machineName(group));setRename(true);}}>重命名机器</button>
                </div></details>
              )}
              <button
                aria-label="切换属性面板"
                aria-pressed={properties}
                onClick={() => setProperties(!properties)}
              >
                <PanelRight size={16} />
              </button>
            </>
          )}
        </div>
      </header>
      <Failure error={daemon.error || control.error} />
      {!mid ? (
        <div className="rt-list-scroll">
          <div className="rt-table" role="grid" aria-label="运行时列表">
            <div className="rt-grid rt-table-head" role="row">
              {["名称", "Harness", "智能体", "负载", "状态"].map((v) => (
                <span key={v} role="columnheader">
                  {v}
                </span>
              ))}
            </div>
            <div className="rt-group" role="row">
              <span role="rowheader">
                机器 <small>{visible.length}</small>
              </span>
            </div>
            {visible.map(([key, rs]) => (
              <button
                key={key}
                className="rt-grid rt-machine-row"
                role="row"
                onClick={() => navigate(key)}
              >
                <span role="gridcell">
                  {rs[0].daemon_id === daemon.data?.daemonId ? <Laptop size={16}/> : <SquareTerminal size={16}/>}
                  <strong>{machineName(rs)}</strong>
                  {rs[0].daemon_id === daemon.data?.daemonId && (
                    <small>本机</small>
                  )}
                  <small>{ownerName(rs[0].owner_id)}</small>
                </span>
                <span role="gridcell">
                  {[...new Set(rs.map((r) => r.provider))].map(provider=><ProviderLogo key={provider} provider={provider}/>)}
                </span>
                <span role="gridcell">{bound(rs).length}</span>
                <span role="gridcell">{loadText(rs)}</span>
                <ConnectionState
                  online={rs.some((r) => r.status === "online")}
                />
              </button>
            ))}
            {!visible.length && (
              <p className="rt-empty">
                {loading
                  ? "正在读取运行时…"
                  : filter === "all"
                    ? "暂无已注册的机器"
                    : "没有符合此状态的机器"}
              </p>
            )}
            <div className="rt-group" role="row">
              <span role="rowheader">
                云服务 <small>{qoder.data?.enabled || config ? 1 : 0}</small>
              </span>
            </div>
            <div className="rt-grid rt-cloud-row" role="row">
              <span role="gridcell">
                <ProviderLogo provider="qoder"/>Qoder Cloud Agents<small>Qoder 提供</small>
                {manage && <QoderConnection manage/>}
              </span>
              <span>—</span>
              <span>{config ? bound([config]).length : "—"}</span>
              <span>—</span>
              <span>
                {config ? (
                  <ConnectionState online={config.status === "online"} />
                ) : qoder.isError ? (
                  "状态不可用"
                ) : qoder.data?.hasToken ? (
                  qoder.data.enabled ? (
                    "等待注册"
                  ) : (
                    "已停用"
                  )
                ) : manage ? (
                  <small className="rt-badge rt-warning">未连接</small>
                ) : (
                  "无可用连接"
                )}
              </span>
            </div>
            {["Cursor Cloud Agents", "Claude Managed Agents"].map((v, i) => (
              <div
                key={v}
                role="row"
                aria-disabled="true"
                className="rt-grid rt-cloud-row"
              >
                <span role="gridcell">
                  <ProviderLogo provider={i ? "claude" : "cursor"}/>
                  {v}
                  <small>{i ? "Anthropic" : "Cursor"} 提供</small>
                </span>
                <span className="rt-cloud-status"><small className="rt-badge">即将推出</small></span>
              </div>
            ))}
            {!!profiles.data?.length && (
              <>
                <div className="rt-group">
                  工作区运行时配置 <small>{profiles.data.length}</small>
                </div>
                {profiles.data.map((p) => (
                  <div key={p.id} className="rt-grid rt-cloud-row" role="row">
                    <span role="gridcell">
                      <Cpu size={16} />
                      {manage ? (
                        <button onClick={() => setEditProfile(p.id)}>
                          {p.display_name}
                        </button>
                      ) : (
                        p.display_name
                      )}
                    </span>
                    <span>{p.protocol_family}</span>
                    <span>—</span>
                    <span>—</span>
                    <span>{p.enabled ? "已启用配置" : "已停用配置"}</span>
                  </div>
                ))}
              </>
            )}
            <Failure error={profiles.error || loads.error} />
          </div>
        </div>
      ) : !group || (rid && !selected) ? (
        <p className="rt-empty">
          {loading ? "正在读取运行时…" : "此运行时不可用"}
        </p>
      ) : (
        <div className="rt-objects">
          <div className="rt-object-body">
            <div className="rt-identity">
              <span className="rt-object-icon">{selected ? <ProviderLogo provider={selected.provider} size={28}/> : <Laptop size={26}/>}</span>
              <div>
                <h2>{selected ? runtimeName(selected) : machineName(group)}{!selected && local && <small className="rt-local-tag">本机</small>}</h2>
                <small>
                  {selected
                    ? machineName(group) +
                      " · " +
                      (selected.profile_id ? "自定义运行时" : "内置运行时")
                    : ownerName(group[0].owner_id) +
                      (local ? " · 本地守护进程" : " · 远程机器") + (group.some(r=>r.status==="online") ? " · 在线" : " · 离线")}
                </small>
              </div>
            </div>
            {!selected ? (
              <>
                <section className="rt-section">
                  <header>
                    <h3>守护进程</h3>
                    {local && mine && (
                      <div className="rt-local-controls">
                        <Action aria-label="查看日志" title="查看日志" onClick={() => setLogsOpen(true)}><ScrollText size={15}/></Action>
                        {enabled && (
                          <Action
                            disabled={control.isPending}
                            aria-label="重启本机执行端" title="重启守护进程"
                            onClick={() => control.mutate("restart")}
                          >
                            <RefreshCw size={15}/>
                          </Action>
                        )}
                        {localAction(true)}
                      </div>
                    )}
                  </header>
                  <div className="rt-card rt-cli-info">
                    <span>CLI 版本：{cliVersion || "未上报"}</span>
                    {local && <small>由桌面端管理</small>}
                  </div>
                </section>
                <section className="rt-section">
                  <header>
                    <h3>
                      运行时 <small>{group.length}</small>
                    </h3>
                    {manage && (
                      <Action onClick={() => setEditProfile("new")}>
                        添加自定义运行时
                      </Action>
                    )}
                  </header>
                  <div className="rt-child-grid rt-table-head">
                    <span>运行时</span>
                    <span>健康度</span>
                    <span>智能体</span>
                    <span>CLI</span>
                  </div>
                  {group.map((r) => (
                    <button
                      key={r.id}
                      className="team-cli-row rt-endpoint rt-child-grid"
                      onClick={() => navigate(mid, r.id)}
                    >
                      <span>
                        <ProviderLogo provider={r.provider}/>
                        <strong>{runtimeName(r)}</strong>
                      </span>
                      <ConnectionState online={r.status === "online"} />
                      <span>{bound([r]).length}</span>
                      <small>
                        {local
                          ? "桌面端"
                          : typeof r.metadata?.cli_version === "string"
                            ? r.metadata.cli_version
                            : "未上报"}{" "}
                        <ChevronRight size={14} />
                      </small>
                    </button>
                  ))}
                </section>
              </>
            ) : (
              <>
                <div className="rt-tabs" role="tablist">
                  {["设置", "智能体", "用量"].map((v) => (
                    <button
                      role="tab"
                      key={v}
                      aria-selected={tab === v}
                      onClick={() => navigate(mid, selected.id, v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                {tab === "智能体" ? (
                  <section className="rt-section">
                    <header>
                      <h3>关联智能体</h3>
                    </header>
                    {bound([selected]).map((a) => (
                      <div className="rt-endpoint" key={a.id}>
                        <Bot size={16} />
                        {a.name}
                      </div>
                    ))}
                    {!bound([selected]).length && <p>暂无关联智能体</p>}
                  </section>
                ) : tab === "用量" ? (
                  <RuntimeUsage id={selected.id} />
                ) : (
                  <RuntimeSettings
                    key={selected.id + ":" + selected.updated_at}
                    runtime={selected}
                    editable={mine}
                  />
                )}
              </>
            )}
          </div>
          {properties && (
            <aside className="rt-properties">
              <h3>属性</h3>
              <dl>
                <dt>状态</dt>
                <dd>
                  <ConnectionState
                    online={
                      selected
                        ? selected.status === "online"
                        : group.some((r) => r.status === "online")
                    }
                  />
                </dd>
                <dt>所有者</dt>
                <dd>{ownerName(group[0].owner_id)}</dd>
                {selected ? <>
                  <dt>运行时</dt><dd>{runtimeName(selected)}</dd>
                  <dt>可见性</dt><dd>{selected.visibility==="public"?"工作区共享":"私有"}</dd>
                  <dt>CLI</dt><dd>{typeof selected.metadata?.cli_version==="string"?selected.metadata.cli_version:"未上报"}</dd>
                </> : <>
                  <dt>设备</dt><dd>{group[0].device_info || "未上报"}</dd>
                  <dt>Harness</dt><dd className="rt-harness">{[...new Set(group.map(r=>r.provider))].map(provider=><ProviderLogo key={provider} provider={provider}/>)}</dd>
                  <dt>负载</dt><dd>{loadText(group)}</dd>
                  <dt>守护进程 ID</dt><dd className="rt-short-id" title={group[0].daemon_id || undefined}>{group[0].daemon_id || "—"}</dd>
                </>}
              </dl>
            </aside>
          )}
        </div>
      )}
      {logsOpen && local && mine && (
        <Modal title="守护进程日志" onClose={() => setLogsOpen(false)}>
          <p>当前执行端最近 200 行日志中的启停、注册和心跳记录。</p>
          <Failure error={logs.error} />
          {logs.data?.length ? (
            <ol className="mw-runtime-log">
              {logs.data.map((entry, index) => (
                <li key={index}>
                  <time>{entry.time}</time>
                  <small>{entry.level}</small>
                  {entry.event}
                </li>
              ))}
            </ol>
          ) : (
            !logs.error && (
              <p>{logs.isPending ? "正在读取日志…" : "最近没有运行状态记录"}</p>
            )
          )}
          <div className="team-actions">
            <Action onClick={() => logs.refetch()}>刷新</Action>
            <Action onClick={() => setLogsOpen(false)}>关闭</Action>
          </div>
        </Modal>
      )}
      {editProfile !== null && (
        <RuntimeProfileForm
          profile={profiles.data?.find((p) => p.id === editProfile)}
          close={() => setEditProfile(null)}
        />
      )}
      {rename && (
        <Modal title="重命名机器" onClose={() => setRename(false)}>
          <Field label="机器名称">
            <Input
              aria-label="机器名称"
              value={name}
              maxLength={100}
              placeholder="留空恢复默认名称"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Failure error={renameMachine.error} />
          <div className="team-actions">
            <Action onClick={() => setRename(false)}>取消</Action>
            <Action
              primary
              disabled={renameMachine.isPending}
              onClick={() => renameMachine.mutate()}
            >
              保存
            </Action>
          </div>
        </Modal>
      )}
    </section>
  );
}
