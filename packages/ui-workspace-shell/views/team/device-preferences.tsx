import { useState } from "react";
import { SettingsInfo, SettingsRow } from "./settings-row";
import { readTeamDaemon } from "./desktop";
import { z } from "zod";
import { useTeamAction, useTeamQuery } from "./client";
import { Action, Field, Failure, Input, Modal } from "./ui";
const daemonStateLabel: Record<string, string> = {
  running: "运行中",
  stopped: "已停止",
  starting: "启动中",
  restart_required: "需要重启",
  unavailable: "不可用",
};
const Device = z.object({
  theme: z.string(),
  language: z.string(),
  close: z.string(),
  version: z.number(),
  chatSize: z.number(),
  models: z.array(z.string()),
  guard: z.boolean(),
  fileProtection: z.boolean(),
  modelProtection: z.boolean(),
  autoLaunch: z.boolean(),
  daemonAutoStart: z.boolean(),
  daemonAutoStop: z.boolean(),
});
type Settings = z.infer<typeof Device>;
async function operation(op: string, args?: Settings) {
  const response = await fetch("/api/workbench/operation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ operation: "device." + op, args }),
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "无法读取本机设置");
  return Device.parse(data);
}
export function useDevicePreferences() {
  return useTeamQuery(["device-preferences"], () => operation("read"));
}
export function DevicePanel({ tab }: { tab: string }) {
  const device = useDevicePreferences();
  const daemon = useTeamQuery(["daemon"], readTeamDaemon, tab === "守护进程");
  const [layer, setLayer] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const save = useTeamAction(async (patch: Partial<Settings>) => {
    if (!device.data) throw Error("设备偏好尚未读取");
    await operation("save", { ...device.data, ...patch });
    await device.refetch();
    if (patch.models) setLayer("");
  });
  const settings = device.data;
  if (!settings) return <Failure error={device.error} />;
  const toggle = (
    key:
      | "guard"
      | "fileProtection"
      | "autoLaunch"
      | "modelProtection"
      | "daemonAutoStart"
      | "daemonAutoStop",
    label: string,
  ) => {
    return (
      <SettingsRow title={label} description="偏好保存在当前设备。">
        <input
          type="checkbox"
          aria-label={label}
          checked={settings[key]}
          disabled={save.isPending}
          onChange={(e) => save.mutate({ [key]: e.target.checked })}
        />
      </SettingsRow>
    );
  };
  const info: Record<string, string> = {
    本地存储:
      "项目、任务、成员和会话保存在服务端 PostgreSQL。当前设备的显示及启动偏好保存在应用资料目录。",
    文件安全:
      "文件列表与下载分别校验工作区及来源权限。此页没有主机受保护目录配置。",
    行为审计: "当前未接入工作区行为审计服务。",
    会话审计: "当前未接入会话审计服务。",
    沙箱审计日志: "当前未接入主机沙箱审计服务。",
    快捷键:
      "全局搜索：⌘/Ctrl + K。发送会话消息：Enter。换行：Shift + Enter。关闭当前弹层：Esc。",
    版本信息: "MobileWork V3",
  };
  const show = (value: string) => {
    setError("");
    setLayer(value);
  };
  const close = () => setLayer("");
  return (
    <>
      <Failure error={device.error || save.error} />
      {tab === "系统设置" && (
        <>
          <SettingsRow
            title="语言"
            description="界面使用简体中文。所选语言保存为设备偏好。"
          >
            <select
              aria-label="语言偏好"
              value={settings.language}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ language: e.target.value })}
            >
              <option>简体中文</option>
              <option>English</option>
            </select>
          </SettingsRow>
          <div className="mw-font-size">
            <strong>字体大小</strong>
            <p>调整本设备的会话正文字号。</p>
            <input
              aria-label="聊天字号"
              type="range"
              min={0}
              max={2}
              step={1}
              value={
                settings.chatSize <= 12 ? 0 : settings.chatSize >= 18 ? 2 : 1
              }
              disabled={save.isPending}
              onChange={(e) =>
                save.mutate({ chatSize: [12, 14, 18][Number(e.target.value)]! })
              }
            />
            <div role="group" aria-label="字号预设">
              {[
                [12, "小12"],
                [14, "默认14"],
                [18, "大18"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  aria-pressed={
                    settings.chatSize === v ||
                    (v === 14 && ![12, 18].includes(settings.chatSize))
                  }
                  disabled={save.isPending}
                  onClick={() => save.mutate({ chatSize: Number(v) })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <SettingsRow title="主题" description="跟随系统，或固定浅色／深色。">
            <div role="group" aria-label="主题">
              {[
                ["light", "浅色"],
                ["dark", "深色"],
                ["system", "跟随系统"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  aria-pressed={settings.theme === v}
                  disabled={save.isPending}
                  onClick={() => save.mutate({ theme: v })}
                >
                  {label}
                </button>
              ))}
            </div>
          </SettingsRow>
          <SettingsRow
            action
            title="存储位置"
            description="查看正式服务与本机的数据存放方式。"
          >
            <Action onClick={() => show("本地存储")}>了解</Action>
          </SettingsRow>
          <SettingsRow title="关闭行为" description="保存本机窗口关闭偏好。">
            <select
              aria-label="关闭偏好"
              value={settings.close}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ close: e.target.value })}
            >
              <option value="保留窗口">最小化到系统托盘</option>
              <option value="退出">退出应用</option>
            </select>
          </SettingsRow>
        </>
      )}
      {tab === "模型" && (
        <>
          <SettingsRow
            title="本地模型样例"
            description="管理显示名称。Work 使用预配置的模型。"
          >
            <Action
              onClick={() => {
                setName("");
                show("添加模型");
              }}
            >
              添加模型
            </Action>
          </SettingsRow>
          {toggle("modelProtection", "模型安全防护")}
          <h3>已保存样例</h3>
          {!settings.models.length && <p>暂无模型样例</p>}
          {settings.models.map((value) => (
            <SettingsRow key={value} title={value} description="本地样例">
              <Action
                onClick={() => {
                  setName(value);
                  show("移除模型");
                }}
              >
                移除 {value}
              </Action>
            </SettingsRow>
          ))}
        </>
      )}
      {tab === "守护进程" && (
        <>
          {toggle("daemonAutoStart", "自动启动守护进程")}
          {toggle("daemonAutoStop", "自动停止守护进程")}
          <SettingsRow
            title="当前执行端"
            description={daemon.data?.daemonId || "本机尚未登记执行端"}
          >
            {daemonStateLabel[daemon.data?.state ?? ""] || "正在读取"}
          </SettingsRow>
          <Failure error={daemon.error} />
        </>
      )}
      {tab === "安全与审计" && (
        <>
          {toggle("guard", "安全防护")}
          {toggle("fileProtection", "沙箱保护")}
          {["文件安全", "行为审计", "会话审计", "沙箱审计日志"].map((key) => (
            <SettingsRow action key={key} title={key} description={info[key]}>
              <Action onClick={() => show(key)}>
                {key === "文件安全" ? "查看" : "查看明细"}
              </Action>
            </SettingsRow>
          ))}
        </>
      )}
      {tab === "软件配置" && (
        <>
          <SettingsRow title="版本信息" description="MobileWork V3">
            <Action
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText("MobileWork V3");
                  setCopied(true);
                } catch {
                  show("版本信息");
                }
              }}
            >
              复制版本信息
            </Action>
            {copied && <small role="status">已复制</small>}
          </SettingsRow>
          {toggle("autoLaunch", "开机启动")}
          <SettingsRow
            action
            title="快捷键"
            description="查看当前支持的快捷操作。"
          >
            <Action onClick={() => show("快捷键")}>查看</Action>
          </SettingsRow>
        </>
      )}
      {layer === "添加模型" && (
        <Modal title={layer} onClose={close}>
          <Field label="样例名称">
            <Input
              aria-label="样例名称"
              value={name}
              maxLength={64}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
          </Field>
          {error && <p role="alert">{error}</p>}
          <Failure error={save.error} />
          <div className="team-actions">
            <Action onClick={close}>取消</Action>
            <Action
              primary
              disabled={save.isPending}
              onClick={() => {
                const value = name.trim();
                if (!value) {
                  setError("请输入模型样例名称");
                  return;
                }
                if (
                  settings.models.some(
                    (m) => m.toLowerCase() === value.toLowerCase(),
                  )
                ) {
                  setError("模型样例名称重复");
                  return;
                }
                save.mutate({ models: [...settings.models, value] });
              }}
            >
              添加
            </Action>
          </div>
        </Modal>
      )}
      {layer === "移除模型" && (
        <Modal title={layer} onClose={close}>
          <p>移除「{name}」？</p>
          <Failure error={save.error} />
          <div className="team-actions">
            <Action onClick={close}>取消</Action>
            <Action
              primary
              disabled={save.isPending}
              onClick={() =>
                save.mutate({
                  models: settings.models.filter((m) => m !== name),
                })
              }
            >
              确认移除
            </Action>
          </div>
        </Modal>
      )}
      {info[layer] && (
        <SettingsInfo title={layer} close={close}>
          {info[layer]}
        </SettingsInfo>
      )}
    </>
  );
}
