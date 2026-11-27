import { useState } from "react";
import { teamApi, useTeamAction } from "./client";
import { Action, Failure, Field, Input, Modal, Textarea } from "./ui";
import type { Agent } from "@multica/core/types";

export function AgentEnvironment({ agent }: { agent: Agent }) {
  const [open, setOpen] = useState(false),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const [section, setSection] = useState<"env" | "args">("args");
  const [validation, setValidation] = useState("");
  const [args, setArgs] = useState(""),
    [env, setEnv] = useState<
      { id: string; name: string; value: string }[] | null
    >(null);
  const unlock = useTeamAction(async () => {
    const values = await teamApi.getAgentEnv(agent.id);
    setEnv(
      Object.entries(values.custom_env || {}).map(([name, value]) => ({
        id: crypto.randomUUID(),
        name,
        value,
      })),
    );
  });
  const close = () => {
    setValidation("");
    setOpen(false);
    setEnv(null);
    setDiscard(false);
    setDirty(false);
  };
  const save = useTeamAction(async () => {
    if (section === "env" && env) {
      const pairs = env.map((e) => [e.name.trim(), e.value]);
      if (
        pairs.some(([name]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) ||
        new Set(pairs.map(([name]) => name)).size !== pairs.length
      ) {
        setValidation(
          "变量名应唯一，仅允许字母、数字和下划线，且不能以数字开头",
        );
        return;
      }
      await teamApi.updateAgentEnv(agent.id, {
        custom_env: Object.fromEntries(pairs),
      });
    }
    const list = args
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean);
    if (
      section === "args" &&
      JSON.stringify(list) !== JSON.stringify(agent.custom_args || [])
    )
      await teamApi.updateAgent(agent.id, { custom_args: list });
    close();
  });
  function change(id: string, field: "name" | "value", value: string) {
    setValidation("");
    setDirty(true);
    setEnv(
      (rows) =>
        rows?.map((e) => (e.id === id ? { ...e, [field]: value } : e)) || [],
    );
  }
  return (
    <>
      <Action
        onClick={() => {
          setSection("args");
          setOpen(true);
          setArgs((agent.custom_args || []).join("\n"));
        }}
      >
        自定义参数
      </Action>
      <Action
        onClick={() => {
          setSection("env");
          setOpen(true);
          setEnv(null);
        }}
      >
        环境变量
      </Action>
      {open && (
        <Modal
          title={"环境与参数 · " + agent.name}
          onClose={() => (dirty ? setDiscard(true) : close())}
        >
          {section === "args" && (
            <Field label="自定义参数 · 每行一个参数">
              <Textarea
                value={args}
                onChange={(e) => {
                  setDirty(true);
                  setArgs(e.target.value);
                }}
              />
            </Field>
          )}
          {section === "env" &&
            (env === null ? (
              <Action
                disabled={unlock.isPending}
                onClick={() => unlock.mutate()}
              >
                解锁环境变量
              </Action>
            ) : (
              <>
                {env.map((e) => (
                  <div className="team-actions" key={e.id}>
                    <Input
                      aria-label="变量名"
                      value={e.name}
                      onChange={(v) => change(e.id, "name", v.target.value)}
                    />
                    <Input
                      aria-label="变量值"
                      type="password"
                      autoComplete="off"
                      value={e.value}
                      onChange={(v) => change(e.id, "value", v.target.value)}
                    />
                    <Action
                      onClick={() => {
                        setDirty(true);
                        setEnv(env.filter((v) => v.id !== e.id));
                      }}
                    >
                      移除
                    </Action>
                  </div>
                ))}
                <Action
                  onClick={() => {
                    setDirty(true);
                    setEnv([
                      ...env,
                      { id: crypto.randomUUID(), name: "", value: "" },
                    ]);
                  }}
                >
                  添加变量
                </Action>
              </>
            ))}
          {validation && (
            <p role="alert" className="tm-error">
              {validation}
            </p>
          )}
          <Failure error={unlock.error || save.error} />
          <Action
            disabled={save.isPending}
            onClick={() => (dirty ? setDiscard(true) : close())}
          >
            关闭
          </Action>
          <Action
            disabled={!dirty || save.isPending}
            onClick={() => save.mutate()}
          >
            保存
          </Action>
          {discard && (
            <Modal title="保存更改？" onClose={() => setDiscard(false)}>
              <Action onClick={() => setDiscard(false)}>继续编辑</Action>
              <Action onClick={close}>放弃更改</Action>
              <Action
                onClick={() => {
                  setDiscard(false);
                  save.mutate();
                }}
              >
                保存
              </Action>
            </Modal>
          )}
        </Modal>
      )}
    </>
  );
}
