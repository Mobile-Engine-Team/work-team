import { Cpu, Palette } from "../icons";
import {
  MwSettingsAccountIcon,
  MwSettingsSystemIcon,
  MwSettingsMemoryIcon,
  MwSettingsModelsIcon,
  MwSettingsChainIcon,
  MwSettingsSecurityIcon,
  MwSettingsHelpIcon,
} from "@/react-app/domains/settings/mobilework/nav-icons";
import manual from "../../../../mloop/design-v3/docs/使用与实现手册.md?raw";
import { SettingsInfo, SettingsRow } from "./settings-row";
import { TeamMarkdown } from "./markdown";
import { DevicePanel, useDevicePreferences } from "./device-preferences";
import { useEffect, useState } from "react";
import { z } from "zod";
import { request } from "../workbench/api";
import { useTeam, useTeamQuery, useTeamAction } from "./client";
import { Action, Failure, Field, Modal, Textarea } from "./ui";
const Pref = z.object({
  theme: z.string(),
  chat_size: z.number(),
  instructions: z.string(),
  memory: z.string(),
  tone: z.string(),
  loading_hints: z.boolean(),
  generate_memory: z.boolean(),
  version: z.number(),
});
export function PersonalSettings({
  open,
  close,
  initialTab = "账户管理",
  onLogout,
}: {
  open: boolean;
  initialTab?: string;
  onLogout: () => void;
  close: () => void;
}) {
  const { workspace, user } = useTeam();
  const pref = useTeamQuery(["preferences", user.id], () =>
    request(workspace.id, "/preferences", Pref),
  );
  const device = useDevicePreferences();
  const [layer, setLayer] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [editor, setEditor] = useState("");
  const [instruction, setInstruction] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setLayer("");
      setInstruction(null);
    }
  }, [open, initialTab]);
  useEffect(() => {
    if (!pref.data) return;
    const root = document.documentElement,
      media = matchMedia("(prefers-color-scheme: dark)");
    const theme = device.data?.version ? device.data.theme : pref.data.theme;
    const size = device.data?.version
      ? device.data.chatSize
      : pref.data.chat_size;
    const inheritedDark = root.classList.contains("dark");
    const apply = () => {
      root.dataset.mwTheme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", root.dataset.mwTheme === "dark");
      root.style.setProperty("--work-chat-size", size + "px");
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      root.classList.toggle("dark", inheritedDark);
      delete root.dataset.mwTheme;
      root.style.removeProperty("--work-chat-size");
    };
  }, [pref.data, device.data]);
  const save = useTeamAction(async (change: Partial<z.infer<typeof Pref>>) => {
    if (!pref.data) throw Error("账号偏好尚未读取");
    await request(
      workspace.id,
      "/preferences",
      Pref,
      { ...pref.data, ...change },
      "PUT",
    );
    await pref.refetch();
    if ("instructions" in change) setInstruction(null);
    if ("memory" in change) setLayer("");
  });
  if (!open) return null;
  const draft = pref.data;
  const actionsDisabled = save.isPending || !draft;
  const closeLayer = () => setLayer("");
  const sections = {
    账户管理: MwSettingsAccountIcon,
    系统设置: MwSettingsSystemIcon,
    记忆: MwSettingsMemoryIcon,
    模型: MwSettingsModelsIcon,
    个性化: Palette,
    软件配置: MwSettingsChainIcon,
    守护进程: Cpu,
    安全与审计: MwSettingsSecurityIcon,
    帮助与反馈: MwSettingsHelpIcon,
  };
  const notes: Record<string, string> = {
    我的积分: "当前工作区没有启用积分账户或计费服务。",
    问题反馈:
      "请向工作区管理员提供出问题的页面、操作步骤和出现时间。仅分享可公开的信息。",
    "关于 MobileWork": "MobileWork V3",
  };
  return (
    <Modal title="设置" onClose={close} className="mw-preferences">
      <nav aria-label="设置菜单">
        {Object.entries(sections).map(([name, Icon]) => (
          <button
            type="button"
            key={name}
            aria-current={tab === name ? "page" : undefined}
            aria-pressed={tab === name}
            onClick={() => {
              setTab(name);
              setInstruction(null);
            }}
          >
            <Icon width={16} height={16} />
            {name}
          </button>
        ))}
      </nav>
      <section className="mw-preferences-body">
        <h2>{tab}</h2>
        <Failure error={pref.error || save.error} />
        {tab === "账户管理" && (
          <>
            <div className="mw-account-card">
              <i>{user.name.slice(0, 1)}</i>
              <strong>{user.name}</strong>
              <div>
                <Action onClick={() => setLayer("退出登录")}>退出登录</Action>
                <Action primary onClick={() => setLayer("我的积分")}>
                  我的积分
                </Action>
              </div>
            </div>
            <p>当前登录账号为 {user.email}。</p>
          </>
        )}
        {["系统设置", "模型", "安全与审计", "守护进程", "软件配置"].includes(
          tab,
        ) && <DevicePanel key={tab} tab={tab} />}
        {tab === "帮助与反馈" && (
          <>
            <SettingsRow
              action
              title="帮助文档"
              description="打开使用与实现手册。"
            >
              <Action onClick={() => setLayer("使用与实现手册")}>打开</Action>
            </SettingsRow>
            {["问题反馈", "关于 MobileWork"].map((name) => (
              <SettingsRow
                action
                key={name}
                title={name}
                description={
                  name === "问题反馈" ? "查看反馈渠道。" : "MobileWork V3"
                }
              >
                <Action onClick={() => setLayer(name)}>查看</Action>
              </SettingsRow>
            ))}
          </>
        )}
        {tab === "记忆" && draft && (
          <>
            <SettingsRow
              title="生成对话记忆"
              description="按身份保存对话记忆偏好。"
            >
              <input
                type="checkbox"
                aria-label="生成对话记忆"
                checked={draft.generate_memory}
                disabled={actionsDisabled}
                onChange={(e) =>
                  save.mutate({ generate_memory: e.target.checked })
                }
              />
            </SettingsRow>
            <SettingsRow
              action
              title="管理对话记忆"
              description={draft.memory || "暂无手动记录。"}
            >
              <Action
                onClick={() => {
                  setEditor(draft.memory);
                  setLayer("管理对话记忆");
                }}
              >
                编辑
              </Action>
            </SettingsRow>
          </>
        )}
        {tab === "个性化" && draft && (
          <>
            <SettingsRow title="回复语气" description="按当前身份保存。">
              <select
                aria-label="回复语气"
                disabled={actionsDisabled}
                value={draft.tone}
                onChange={(e) => save.mutate({ tone: e.target.value })}
              >
                {["简洁", "严谨", "友好"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </SettingsRow>
            <SettingsRow
              title="加载提示"
              description="按当前身份记录加载提示偏好。"
            >
              <input
                type="checkbox"
                aria-label="加载提示"
                checked={draft.loading_hints}
                disabled={actionsDisabled}
                onChange={(e) =>
                  save.mutate({ loading_hints: e.target.checked })
                }
              />
            </SettingsRow>
            <Field label="自定义指令">
              <small>清空后保存可删除指令。</small>
              <Textarea
                aria-label="自定义指令"
                rows={3}
                maxLength={150}
                value={instruction ?? draft.instructions}
                onChange={(e) => setInstruction(e.target.value)}
              />
            </Field>
            <div className="team-actions">
              <small>{(instruction ?? draft.instructions).length}/150</small>
              <Action
                primary
                disabled={
                  actionsDisabled ||
                  instruction === null ||
                  instruction === draft.instructions
                }
                onClick={() => save.mutate({ instructions: instruction ?? "" })}
              >
                保存指令
              </Action>
            </div>
          </>
        )}
      </section>
      {layer === "使用与实现手册" && (
        <Modal title="使用与实现手册 · 设计参考" onClose={closeLayer} wide>
          <TeamMarkdown content={manual} images={false} />
        </Modal>
      )}
      {layer === "管理对话记忆" && (
        <Modal title={layer} onClose={closeLayer}>
          <Field label="手动记忆（保存空内容可清除）">
            <Textarea
              aria-label="手动记忆"
              rows={6}
              maxLength={2000}
              value={editor}
              onChange={(e) => setEditor(e.target.value)}
            />
          </Field>
          <Failure error={save.error} />
          <div className="team-actions">
            <Action onClick={closeLayer}>取消</Action>
            <Action
              primary
              disabled={actionsDisabled}
              onClick={() => save.mutate({ memory: editor.trim() })}
            >
              保存
            </Action>
          </div>
        </Modal>
      )}
      {layer === "退出登录" && (
        <Modal title={layer} onClose={closeLayer}>
          <p>退出当前账号 {user.email}？</p>
          <div className="team-actions">
            <Action onClick={closeLayer}>取消</Action>
            <Action
              primary
              onClick={() => {
                close();
                onLogout();
              }}
            >
              确认退出
            </Action>
          </div>
        </Modal>
      )}
      {notes[layer] && (
        <SettingsInfo title={layer} close={closeLayer}>
          {notes[layer]}
        </SettingsInfo>
      )}
    </Modal>
  );
}
