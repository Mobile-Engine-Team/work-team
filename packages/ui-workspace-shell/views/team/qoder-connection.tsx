import { useState } from "react";
import { QODER_REGIONS, type QoderInput } from "@multica/core/runtimes/qoder";
import { teamApi, useTeam, useTeamQuery, useTeamAction } from "./client";
import { Action, Failure, Field, Input, Modal } from "./ui";

export function QoderConnection({ manage }: { manage: boolean }) {
  const { workspace } = useTeam(),
    id = workspace.id;
  const query = useTeamQuery(
    ["qoder"],
    () => teamApi.getQoderConnection(id),
    manage,
  );
  const [open, setOpen] = useState(false),
    [disconnect, setDisconnect] = useState(false);
  const [values, setValues] = useState<QoderInput>(),
    [catalog, setCatalog] = useState<
      Awaited<ReturnType<typeof teamApi.listQoderEnvironments>>
    >([]);
  const [repo, setRepo] = useState(""),
    [repoToken, setRepoToken] = useState(""),
    [message, setMessage] = useState("");
  const runtimes = useTeamQuery(
    ["runtimes"],
    () => teamApi.listRuntimes({ workspace_id: id }),
    disconnect,
  );
  const agents = useTeamQuery(
    ["agents"],
    () => teamApi.listAgents({ workspace_id: id }),
    disconnect,
  );
  const boundIds = new Set(
    runtimes.data
      ?.filter((r) => String(r.provider) === "qoder_cloud")
      .map((r) => r.id),
  );
  const affected =
    agents.data?.filter((a) => !a.archived_at && boundIds.has(a.runtime_id)) ||
    [];
  function close() {
    setOpen(false);
    setDisconnect(false);
    setValues(undefined);
    setRepo("");
    setRepoToken("");
    setCatalog([]);
    setMessage("");
  }
  const change = useTeamAction(async (action: string) => {
    if (action === "disconnect") {
      await teamApi.disconnectQoderConnection(
        id,
        affected.map((a) => a.id),
      );
      close();
    } else if (action === "stop") {
      await teamApi.stopQoderConnection(id);
      close();
    } else if (values) {
      if (
        (!values.qoderToken && !query.data?.hasToken) ||
        (values.qoderToken && !/^pt-[A-Za-z0-9_.-]+$/.test(values.qoderToken))
      ) {
        setMessage("请输入以 pt- 开头的有效令牌");
        return;
      }
      if (action === "catalog") {
        const items = await teamApi.listQoderEnvironments(
          id,
          values.qoderToken,
          values.baseUrl,
        );
        setCatalog(items);
        setMessage(items.length ? "已读取可用环境" : "此凭据没有可用环境");
        setValues({
          ...values,
          environmentId: items.some((v) => v.id === values.environmentId)
            ? values.environmentId
            : items[0]?.id || "",
        });
        return;
      }
      if (!values.name.trim() || !values.environmentId) {
        setMessage("请填写名称并选择环境");
        return;
      }
      if (
        !Number.isInteger(values.maxConcurrency) ||
        values.maxConcurrency < 1 ||
        values.maxConcurrency > 10 ||
        !Number.isInteger(values.runTimeoutMinutes) ||
        values.runTimeoutMinutes < 5 ||
        values.runTimeoutMinutes > 240
      ) {
        setMessage("并发应为 1–10，运行超时应为 5–240 分钟");
        return;
      }
      const input = { ...values, name: values.name.trim() };
      if (repo || repoToken) {
        if (
          !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(repo) ||
          !repoToken
        ) {
          setMessage("请填写 GitHub 仓库 HTTPS 地址和仓库令牌");
          return;
        }
        input.githubTokens = { [repo]: repoToken };
      }
      await teamApi.checkQoderConnection(id, input);
      if (action === "resume") await teamApi.resumeQoderConnection(id, input);
      else await teamApi.saveQoderConnection(id, input);
      close();
    }
    await query.refetch();
  });
  if (!manage) return null;
  const c = query.data;
  const begin = () => {
    setValues({
      name: c?.name || "Qoder Cloud Agents",
      baseUrl: c?.baseUrl || QODER_REGIONS.global,
      environmentId: c?.environmentId || "",
      qoderToken: "",
      maxConcurrency: c?.maxConcurrency || 3,
      runTimeoutMinutes: c?.runTimeoutMinutes || 60,
    });
    setCatalog(
      c?.environmentId ? [{ id: c.environmentId, name: c.environmentId }] : [],
    );
    change.reset();
    setOpen(true);
  };
  return (
    <>
      <Action aria-label="Qoder Cloud Agents" title="管理 Qoder Cloud Agents 连接" onClick={begin}>{c?.hasToken ? "管理" : "连接"}</Action>
      {open && values && (
        <Modal
          title="Qoder Cloud Agents"
          onClose={() => {
            if (!change.isPending) close();
          }}
        >
          <Failure error={query.error || change.error} />
          {query.isPending ? (
            <p role="status">读取运行时配置…</p>
          ) : !c?.available ? (
            <p role="status">服务端未启用凭据加密，暂时无法连接。</p>
          ) : (
            <>
              {c.configured && (
                <p>
                  状态 · {c.status}　运行中 {c.activeRuns}　待处理{" "}
                  {c.queuedRuns}
                </p>
              )}
              <Field label="名称">
                <Input
                  value={values.name}
                  onChange={(e) =>
                    setValues({ ...values, name: e.target.value })
                  }
                />
              </Field>
              <Field label="服务区域">
                <select
                  value={values.baseUrl}
                  onChange={(e) => {
                    setValues({
                      ...values,
                      baseUrl: e.target.value,
                      environmentId: "",
                      qoderToken: "",
                    });
                    setCatalog([]);
                  }}
                >
                  <option value={QODER_REGIONS.global}>全球</option>
                  <option value={QODER_REGIONS.cn}>中国内地</option>
                </select>
              </Field>
              <Field label="访问令牌">
                <Input
                  type="password"
                  autoComplete="off"
                  value={values.qoderToken}
                  placeholder={c.hasToken ? "保留已有凭据" : "pt-…"}
                  onChange={(e) => {
                    setMessage("");
                    setValues({ ...values, qoderToken: e.target.value });
                  }}
                />
              </Field>
              <Action
                disabled={change.isPending}
                onClick={() => change.mutate("catalog")}
              >
                验证并读取环境
              </Action>
              <Field label="环境">
                <select
                  value={values.environmentId}
                  onChange={(e) =>
                    setValues({ ...values, environmentId: e.target.value })
                  }
                >
                  <option value="">选择环境</option>
                  {catalog.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="最大并发">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={values.maxConcurrency}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      maxConcurrency: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="超时（分钟）">
                <Input
                  type="number"
                  min={5}
                  max={240}
                  value={values.runTimeoutMinutes}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      runTimeoutMinutes: Number(e.target.value),
                    })
                  }
                />
              </Field>
              {!c.repositories.length && (
                <details>
                  <summary>可选仓库配置</summary>
                  <Field label="GitHub 仓库">
                    <Input
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                    />
                  </Field>
                  <Field label="仓库令牌">
                    <Input
                      type="password"
                      autoComplete="off"
                      value={repoToken}
                      onChange={(e) => setRepoToken(e.target.value)}
                    />
                  </Field>
                </details>
              )}
              {!!c.repositories.length && (
                <p>已绑定仓库 · {c.repositories.join("、")}</p>
              )}
              {message && <p role="status">{message}</p>}
              <div className="team-actions">
                <Action
                  disabled={change.isPending}
                  onClick={() => change.mutate("save")}
                >
                  测试并保存
                </Action>
                {c.configured && (
                  <>
                    <Action
                      disabled={change.isPending}
                      onClick={() =>
                        change.mutate(c.enabled ? "stop" : "resume")
                      }
                    >
                      {c.enabled ? "停用" : "启用"}
                    </Action>
                    <Action
                      disabled={change.isPending}
                      onClick={() => setDisconnect(true)}
                    >
                      断开
                    </Action>
                  </>
                )}
              </div>
            </>
          )}
          <Action disabled={change.isPending} onClick={close}>
            取消
          </Action>
        </Modal>
      )}
      {disconnect && (
        <Modal
          title="断开 Qoder Cloud Agents"
          onClose={() => setDisconnect(false)}
        >
          <p>
            受影响的智能体 · {affected.map((a) => a.name).join("、") || "无"}
          </p>
          <Failure error={change.error || runtimes.error || agents.error} />
          <Action onClick={() => setDisconnect(false)}>返回</Action>
          <Action
            disabled={
              change.isPending || !runtimes.isSuccess || !agents.isSuccess
            }
            onClick={() => change.mutate("disconnect")}
          >
            确认断开
          </Action>
        </Modal>
      )}
    </>
  );
}
