import { useState } from "react";
import type { RuntimeProfile, RuntimeProfileType } from "@multica/core/types";
import { RUNTIME_PROFILE_RUNTIME_TYPES } from "@multica/core/types";
import { Action, Failure, Field, Input, Modal, Textarea } from "./ui";
import { teamApi, useTeam, useTeamAction } from "./client";

export function RuntimeProfileForm({
  profile,
  close,
}: {
  profile?: RuntimeProfile;
  close: () => void;
}) {
  const { workspace } = useTeam();
  const [step, setStep] = useState(profile ? 2 : 1);
  const [family, setFamily] = useState<RuntimeProfileType>(
    profile?.runtime_type || profile?.protocol_family || "codex",
  );
  const [name, setName] = useState(profile?.display_name || ""),
    [command, setCommand] = useState(profile?.command_name || "");
  const [description, setDescription] = useState(profile?.description || ""),
    [args, setArgs] = useState(profile?.fixed_args.join("\n") || "");
  const [enabled, setEnabled] = useState(profile?.enabled ?? false),
    [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const save = useTeamAction(async (operation: "save" | "delete") => {
    if (operation === "delete" && profile) {
      await teamApi.deleteRuntimeProfile(workspace.id, profile.id);
    } else {
      if (!name.trim() || !command.trim()) {
        setError("请填写名称和命令");
        return;
      }
      if (/[\s\x00]/u.test(command.trim())) {
        setError("启动命令只接受一个可执行文件，参数请另填");
        return;
      }
      const fields = {
        display_name: name.trim(),
        command_name: command.trim(),
        description: description.trim(),
        fixed_args: args
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        enabled,
      };
      if (profile)
        await teamApi.updateRuntimeProfile(workspace.id, profile.id, fields);
      else
        await teamApi.createRuntimeProfile(workspace.id, {
          ...fields,
          runtime_type: family,
        });
    }
    close();
  });
  return (
    <Modal
      title={profile ? "编辑自定义运行时" : "添加自定义运行时"}
      onClose={() => {
        if (!save.isPending) close();
      }}
    >
      {step === 1 ? (
        <>
          <Field label="基础 Harness">
            <select
              aria-label="基础 Harness"
              value={family}
              onChange={(e) => setFamily(e.target.value as RuntimeProfileType)}
            >
              {RUNTIME_PROFILE_RUNTIME_TYPES.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <div className="team-actions">
            <Action onClick={close}>取消</Action>
            <Action primary onClick={() => setStep(2)}>
              下一步
            </Action>
          </div>
        </>
      ) : (
        <>
          <Field label="名称">
            <Input
              aria-label="配置名称"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="命令">
            <Input
              aria-label="启动命令"
              maxLength={256}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
          </Field>
          <Field label="描述">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="固定参数（每行一个）">
            <Textarea value={args} onChange={(e) => setArgs(e.target.value)} />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />{" "}
            启用配置，允许本工作区的执行端注册
          </label>
          {error && <p role="alert">{error}</p>}
          <Failure error={save.error} />
          <div className="team-actions">
            {profile ? (
              <Action onClick={() => setRemove(true)}>移除配置</Action>
            ) : (
              <Action onClick={() => setStep(1)}>上一步</Action>
            )}
            <Action disabled={save.isPending} onClick={close}>
              取消
            </Action>
            <Action
              primary
              disabled={save.isPending}
              onClick={() => save.mutate("save")}
            >
              保存配置
            </Action>
          </div>
        </>
      )}
      {remove && profile && (
        <Modal title="移除运行时配置" onClose={() => setRemove(false)}>
          <p>移除「{profile.display_name}」？</p>
          <Failure error={save.error} />
          <div className="team-actions">
            <Action onClick={() => setRemove(false)}>取消</Action>
            <Action
              disabled={save.isPending}
              onClick={() => save.mutate("delete")}
            >
              确认移除
            </Action>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
