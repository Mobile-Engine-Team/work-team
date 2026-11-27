import { Copy, Crown, Link as LinkIcon, Mail, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Users } from "../icons";
import { WorkspaceAvatar } from "./workspace-avatar";
import { SpaceOverview } from "./space-overview";
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { z } from "zod";
import { IDSchema, request } from "../workbench/api";
import { teamApi, useTeam, useTeamAction, useTeamQuery } from "./client";
import { teamFetch } from "./request-transport";
import { Action, Failure, Modal, Picker } from "./ui";

const LinkSchema = z.object({
  id: z.string(),
  token: z.string(),
  enabled: z.boolean(),
  expires_at: z.string(),
});
export function SpacePage() {
  const { workspace, user } = useTeam();
  const ws = workspace.id;
  const members = useTeamQuery(["members"], () => teamApi.listMembers(ws));
  const role = members.data?.find((m) => m.user_id === user.id)?.role;
  const manage = role === "owner" || role === "admin";
  const invites = useTeamQuery(
    ["invitations"],
    () => teamApi.listWorkspaceInvitations(ws),
    manage,
  );
  const links = useTeamQuery(
    ["join-links"],
    () => request(ws, "/join-links", LinkSchema.array()),
    manage,
  );
  const [params, setParams] = useSearchParams();
  const [panel, setPanel] = useState(
      params.get("invite") === "1"
        ? "invite"
        : params.get("members") === "1"
          ? "members"
          : "",
    ),
    [section, setSection] = useState("成员"),
    [search, setSearch] = useState("");
  const [name, setName] = useState(workspace.name),
    [desc, setDesc] = useState(workspace.description || ""),
    [context, setContext] = useState(workspace.context || "");
  const [avatar, setAvatar] = useState(workspace.avatar_url || "");
  const [reading, setReading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [menu, setMenu] = useState("");
  const [localError, setLocalError] = useState("");
  const dirty =
    avatar !== (workspace.avatar_url || "") ||
    name !== workspace.name ||
    desc !== (workspace.description || "") ||
    context !== (workspace.context || "");

  const roleName = (r?: string) =>
    r === "owner" ? "所有者" : r === "admin" ? "管理员" : "成员";
  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("已复制");
    } catch {
      setCopyStatus("复制失败，请重试");
    }
  }
  const [emails, setEmails] = useState(""),
    [inviteRole, setInviteRole] = useState("member");
  const [confirm, setConfirm] = useState<{
    label: string;
    run: () => Promise<unknown>;
  } | null>(null);
  const change = useTeamAction(async (fn: () => Promise<unknown>) => {
    await fn();
    setMenu("");
    setConfirm(null);
  });
  const save = useTeamAction(async () => {
    await teamApi.updateWorkspace(ws, {
      name: name.trim(),
      description: desc.trim(),
      context: context.trim(),
      avatar_url: avatar,
    });
    setName(name.trim());
    setDesc(desc.trim());
    setContext(context.trim());
    window.dispatchEvent(new Event("team:workspaces-changed"));
    setSaved(true);
  });
  const invite = useTeamAction(async () => {
    const targets = [
      ...new Set(
        emails
          .toLowerCase()
          .trim()
          .split(/[\s,，]+/)
          .filter(Boolean),
      ),
    ];
    if (
      !targets.length ||
      targets.some((s) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    ) {
      setLocalError("请输入有效邮箱");
      return;
    }
    if (
      targets.some(
        (email) =>
          members.data?.some((m) => m.email.toLowerCase() === email) ||
          invites.data?.some(
            (i) =>
              i.invitee_email.toLowerCase() === email && i.status === "pending",
          ),
      )
    ) {
      setLocalError("邮箱已是成员或已有待接受邀请");
      return;
    }
    const failures = [];
    for (const email of targets) {
      try {
        await teamApi.createMember(ws, {
          email,
          role: inviteRole as "member" | "admin",
        });
      } catch {
        failures.push(email);
      }
    }
    await invites.refetch();
    setEmails(failures.join(", "));
    if (failures.length) {
      setLocalError("邀请未创建：" + failures.join("、"));
      return;
    }
    setPanel("members");
    setSection("待接受邀请");
  });
  function openSettings(tab: string) {
    setAvatar(workspace.avatar_url || "");
    setName(workspace.name);
    setDesc(workspace.description || "");
    setContext(workspace.context || "");
    setSearch("");
    setSection("成员");
    setMenu("");
    setCopyStatus("");
    setSaved(false);
    setPanel(tab);
  }
  function openInvite() {
    setEmails("");
    setInviteRole("member");
    setLocalError("");
    invite.reset();
    setPanel("invite");
  }
  useEffect(() => {
    if (params.get("manage") !== "general") return;
    openSettings("profile");
    const next = new URLSearchParams(params);
    next.delete("manage");
    setParams(next, { replace: true });
  }, [params, workspace.id]);
  function closeSettings() {
    if (manage && dirty)
      setConfirm({ label: "放弃未保存的修改", run: async () => setPanel("") });
    else setPanel("");
  }
  const pending = (invites.data || []).filter((i) => i.status === "pending");
  const query = search.trim().toLowerCase();
  const filteredMembers = (members.data || []).filter((m) =>
    (m.name + " " + m.email).toLowerCase().includes(query),
  );
  const filteredInvites = pending.filter((i) =>
    i.invitee_email.toLowerCase().includes(query),
  );
  const general = panel === "profile";
  const memberTab = (value: string) => {
    setSection(value);
    setMenu("");
    setSearch("");
    setCopyStatus("");
  };
  const resetTab = (value: string) => {
    setPanel(value);
    memberTab("成员");
  };
  return (
    <section className="v3-space">
      <SpaceOverview
        edit={() => openSettings("profile")}
        members={() => openSettings("members")}
        invite={() => {
          openSettings("members");
          openInvite();
        }}
      />
      <Failure error={members.error} />
      {panel && (
        <Modal
          title="团队设置"
          className="tm-settings-dialog"
          onClose={closeSettings}
        >
          <div className="tm-settings-layout">
            <nav aria-label="团队设置导航" className="tm-settings-nav">
              <div className="tm-settings-identity">
                <span className="tm-avatar">
                  {workspace.avatar_url ? (
                    <img alt="" src={workspace.avatar_url} />
                  ) : (
                    workspace.name.slice(0, 1)
                  )}
                </span>
                <strong>{workspace.name}</strong>
                <small>{roleName(role)}</small>
              </div>
              <span className="tm-nav-caption">团队</span>
              <button
                aria-current={general ? "page" : undefined}
                onClick={() => resetTab("profile")}
              >
                <Settings size={17} />
                基础信息
              </button>
              <button
                aria-current={!general ? "page" : undefined}
                onClick={() => resetTab("members")}
              >
                <Users size={17} />
                成员管理<span>{members.data?.length}</span>
              </button>
              <p>此处配置仅用于当前团队。</p>
            </nav>
            <main className="tm-settings-main">
              <header className="tm-settings-heading">
                <div>
                  <h3>{general ? "基础信息" : "成员管理"}</h3>
                  <p>
                    {general
                      ? "让成员了解团队的目标与协作方式。"
                      : "管理团队成员、角色与加入方式。"}
                  </p>
                </div>
                {!general && manage && (
                  <Action primary onClick={openInvite}>
                    <Plus size={16} />
                    邀请成员
                  </Action>
                )}
              </header>
              {!manage && (
                <div className="tm-readonly">
                  <ShieldCheck size={15} />
                  你可以查看团队信息，联系所有者或管理员进行修改。
                </div>
              )}
              {general ? (
                <form
                  className="tm-general-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (
                      manage &&
                      dirty &&
                      name.trim() &&
                      !reading &&
                      !save.isPending
                    )
                      save.mutate();
                  }}
                >
                  <section className="tm-settings-card">
                    <div className="tm-info-row">
                      <WorkspaceAvatar
                        value={avatar}
                        name={name}
                        onChange={(v) => {
                          setSaved(false);
                          setAvatar(v);
                        }}
                        reading={reading}
                        setReading={setReading}
                        disabled={!manage}
                      />
                    </div>
                    <div className="tm-info-row">
                      <label className="tm-field">
                        <span>团队名称</span>
                        <input
                          aria-label="团队名称"
                          required
                          disabled={!manage}
                          maxLength={30}
                          value={name}
                          onChange={(e) => {
                            setSaved(false);
                            setName(e.target.value);
                          }}
                        />
                      </label>
                    </div>
                    <div className="tm-info-row">
                      <label className="tm-field">
                        <span>描述</span>
                        <textarea
                          aria-label="团队描述"
                          rows={3}
                          disabled={!manage}
                          maxLength={200}
                          placeholder="这个团队主要做什么？"
                          value={desc}
                          onChange={(e) => {
                            setSaved(false);
                            setDesc(e.target.value);
                          }}
                        />
                      </label>
                    </div>
                    <div className="tm-info-row">
                      <label className="tm-field">
                        <span>
                          智能体上下文 <em>选填</em>
                        </span>
                        <p>为团队中的智能体统一提供业务背景与协作约定。</p>
                        <textarea
                          aria-label="智能体上下文"
                          rows={4}
                          disabled={!manage}
                          maxLength={2000}
                          placeholder="例如：目标用户、业务背景、团队协作方式…"
                          value={context}
                          onChange={(e) => {
                            setSaved(false);
                            setContext(e.target.value);
                          }}
                        />
                      </label>
                    </div>
                    <div className="tm-info-row tm-readonly-row">
                      <span>
                        <strong>团队标识</strong>
                        <small>创建后保持不变，用于识别团队。</small>
                      </span>
                      <code>{ws}</code>
                      <button
                        type="button"
                        aria-label="复制团队标识"
                        className="tm-icon-button"
                        onClick={() => void copyValue(ws)}
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </section>
                  <div className="tm-save-row">
                    <Failure error={save.error} />
                    {saved && !dirty && <span role="status">修改已保存</span>}
                    {manage && (
                      <Action
                        primary
                        type="submit"
                        disabled={
                          !dirty || !name.trim() || reading || save.isPending
                        }
                      >
                        保存修改
                      </Action>
                    )}
                  </div>
                </form>
              ) : (
                <>
                  <div className="tm-member-toolbar">
                    <div
                      role="tablist"
                      aria-label="成员分类"
                      className="tm-member-tabs"
                    >
                      {(manage
                        ? ["成员", "待接受邀请", "邀请链接"]
                        : ["成员"]
                      ).map((tab, index) => (
                        <button
                          role="tab"
                          key={tab}
                          aria-selected={section === tab}
                          onClick={() => memberTab(tab)}
                        >
                          {tab}
                          <span>
                            {[
                              members.data?.length,
                              pending.length,
                              links.data?.length,
                            ][index] ?? 0}
                          </span>
                        </button>
                      ))}
                    </div>
                    {section !== "邀请链接" && (
                      <label className="tm-member-search">
                        <Search size={15} />
                        <input
                          aria-label="搜索姓名或邮箱"
                          placeholder="搜索姓名或邮箱"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                    )}
                  </div>
                  {section === "成员" && (
                    <section className="tm-member-list" aria-label="团队成员">
                      {filteredMembers.map((m) => (
                        <div key={m.id} className="tm-member-row">
                          <span className="tm-person-avatar">
                            {(m.name || m.email).slice(0, 1).toUpperCase()}
                          </span>
                          <div className="tm-member-name">
                            <strong>
                              {m.name}
                              {m.user_id === user.id && <small>你</small>}
                            </strong>
                            <span>{m.email}</span>
                          </div>
                          {m.created_at && (
                            <span className="tm-member-date">
                              {new Date(m.created_at).toLocaleDateString()} 加入
                            </span>
                          )}
                          <span className="tm-member-role">
                            {m.role === "owner" ? (
                              <Crown size={15} />
                            ) : m.role === "admin" ? (
                              <ShieldCheck size={15} />
                            ) : (
                              <Users size={15} />
                            )}{" "}
                            {roleName(m.role)}
                          </span>
                          <div className="tm-member-action">
                            {manage &&
                              m.role !== "owner" &&
                              m.user_id !== user.id && (
                                <>
                                  <button
                                    aria-label={"管理成员 " + m.name}
                                    aria-expanded={menu === m.id}
                                    onClick={() =>
                                      setMenu(menu === m.id ? "" : m.id)
                                    }
                                  >
                                    <MoreHorizontal size={17} />
                                  </button>
                                  {menu === m.id && (
                                    <div
                                      className="tm-action-pop"
                                      role="group"
                                      aria-label="成员操作"
                                    >
                                      <button
                                        disabled={change.isPending}
                                        onClick={() =>
                                          change.mutate(() =>
                                            teamApi.updateMember(ws, m.id, {
                                              role:
                                                m.role === "admin"
                                                  ? "member"
                                                  : "admin",
                                            }),
                                          )
                                        }
                                      >
                                        {m.role === "admin"
                                          ? "设为成员"
                                          : "设为管理员"}
                                      </button>
                                      <button
                                        onClick={() =>
                                          setConfirm({
                                            label: "移出团队",
                                            run: () =>
                                              teamApi.deleteMember(ws, m.id),
                                          })
                                        }
                                      >
                                        移出团队
                                      </button>
                                    </div>
                                  )}
                                </>
                              )}
                          </div>
                        </div>
                      ))}
                      {!filteredMembers.length && (
                        <div className="tm-empty">
                          <Users size={26} />
                          没有找到成员
                        </div>
                      )}
                    </section>
                  )}
                  {section === "待接受邀请" && manage && (
                    <section className="tm-member-list" aria-label="待接受邀请">
                      {filteredInvites.map((i) => (
                        <div key={i.id} className="tm-member-row">
                          <span className="tm-person-avatar">
                            <Mail size={18} />
                          </span>
                          <div className="tm-member-name">
                            <strong>{i.invitee_email}</strong>
                            <span>待接受 · {roleName(i.role)}</span>
                          </div>
                          <button
                            className="tm-text-button"
                            onClick={() =>
                              void copyValue(
                                location.origin + "/#/team?invitation=" + i.id,
                              )
                            }
                          >
                            复制邀请
                          </button>
                          <button
                            className="tm-text-button"
                            onClick={() =>
                              setConfirm({
                                label: "撤销邀请",
                                run: () => teamApi.revokeInvitation(ws, i.id),
                              })
                            }
                          >
                            撤销
                          </button>
                        </div>
                      ))}
                      {!filteredInvites.length && (
                        <div className="tm-empty">
                          <Mail size={26} />
                          <strong>
                            {query ? "没有匹配的邀请" : "暂无待接受的邀请"}
                          </strong>
                          <p>邀请伙伴加入，一起推进团队工作。</p>
                        </div>
                      )}
                    </section>
                  )}
                  {section === "邀请链接" && manage && (
                    <section>
                      <div className="tm-links-intro">
                        <span>
                          <strong>通过链接邀请成员</strong>
                          <p>链接有效期为 7 天，可随时停用。</p>
                        </span>
                        <Action
                          disabled={change.isPending}
                          onClick={() =>
                            change.mutate(() =>
                              request(ws, "/join-links", LinkSchema, {}),
                            )
                          }
                        >
                          <Plus size={15} />
                          创建邀请链接
                        </Action>
                      </div>
                      <div className="tm-member-list">
                        {links.data?.map((l) => {
                          const expired =
                            new Date(l.expires_at).getTime() <= Date.now();
                          return (
                            <div className="tm-link-row" key={l.id}>
                              <span className="tm-person-avatar">
                                <LinkIcon size={18} />
                              </span>
                              <span>
                                <strong>以成员身份加入</strong>
                                <small>
                                  {!l.enabled
                                    ? "已停用"
                                    : expired
                                      ? "已过期"
                                      : new Date(
                                          l.expires_at,
                                        ).toLocaleDateString() + " 到期"}
                                </small>
                              </span>
                              <Action
                                disabled={!l.enabled || expired}
                                onClick={() =>
                                  void copyValue(
                                    location.origin + "/#/team?join=" + l.token,
                                  )
                                }
                              >
                                <Copy size={14} />
                                复制链接
                              </Action>
                              <div className="tm-member-action">
                                <button
                                  aria-label={"管理邀请链接 " + l.id}
                                  aria-expanded={menu === l.id}
                                  onClick={() =>
                                    setMenu(menu === l.id ? "" : l.id)
                                  }
                                >
                                  <MoreHorizontal size={17} />
                                </button>
                                {menu === l.id && (
                                  <div className="tm-action-pop">
                                    <button
                                      disabled={change.isPending}
                                      onClick={() =>
                                        change.mutate(() =>
                                          request(
                                            ws,
                                            "/join-links/" + l.id,
                                            IDSchema,
                                            { enabled: !l.enabled },
                                            "PUT",
                                          ),
                                        )
                                      }
                                    >
                                      {l.enabled ? "停用链接" : "启用链接"}
                                    </button>
                                    <button
                                      onClick={() =>
                                        setConfirm({
                                          label: "删除链接",
                                          run: () =>
                                            request(
                                              ws,
                                              "/join-links/" + l.id,
                                              IDSchema,
                                              undefined,
                                              "DELETE",
                                            ),
                                        })
                                      }
                                    >
                                      删除链接
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {!links.data?.length && (
                          <div className="tm-empty">
                            <LinkIcon size={26} />
                            <strong>暂无邀请链接</strong>
                            <p>为团队创建一个可分享的加入入口。</p>
                          </div>
                        )}
                      </div>
                    </section>
                  )}
                  <div className="tm-member-help">
                    <ShieldCheck size={16} />
                    <p>
                      所有者管理团队，管理员管理信息与成员，成员参与团队协作。
                    </p>
                  </div>
                  <p className="tm-preview-note">
                    成员可通过站内通知或邀请链接接受邀请。
                  </p>
                  <Failure
                    error={change.error || invites.error || links.error}
                  />
                </>
              )}
              {copyStatus && <p role="status">{copyStatus}</p>}
            </main>
          </div>
          {manage && panel === "invite" && (
            <Modal
              title="邀请成员"
              className="tm-invite-dialog"
              onClose={() => setPanel("members")}
            >
              <form
                className="tm-dialog-body"
                id="mw-invite-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!invite.isPending && emails.trim()) invite.mutate();
                }}
              >
                <p className="tm-intro-description">
                  邀请伙伴加入「{workspace.name}」
                </p>
                <label className="tm-field">
                  <span>邮箱地址</span>
                  <textarea
                    aria-label="邀请邮箱"
                    rows={3}
                    placeholder="name@company.com，支持多个邮箱"
                    value={emails}
                    onChange={(e) => {
                      setEmails(e.target.value);
                      setLocalError("");
                    }}
                  />
                </label>
                <div className="tm-invite-role">
                  <span>加入后的角色</span>
                  <Picker
                    label="邀请角色"
                    value={inviteRole}
                    onChange={setInviteRole}
                    options={[
                      { value: "member", label: "成员" },
                      { value: "admin", label: "管理员" },
                    ]}
                  />
                </div>
                <p className="tm-preview-note">
                  创建后可复制邀请链接。收件人可在站内通知中查看邀请。
                </p>
                {localError && (
                  <p className="tm-error" role="alert">
                    {localError}
                  </p>
                )}
                <Failure error={invite.error} />
              </form>
              <footer>
                <Action onClick={() => setPanel("members")}>取消</Action>
                <Action
                  type="submit"
                  form="mw-invite-form"
                  primary
                  disabled={invite.isPending || !emails.trim()}
                >
                  创建邀请
                </Action>
              </footer>
            </Modal>
          )}
          {confirm && (
            <Modal
              title={confirm.label}
              className="tm-confirm-dialog"
              onClose={() => setConfirm(null)}
            >
              <p className="tm-dialog-body">
                {confirm.label === "放弃未保存的修改"
                  ? "本次修改还没有保存。"
                  : confirm.label === "移出团队"
                    ? "该成员将失去此团队的访问权限。"
                    : "此邀请将不能继续使用，已加入的成员不受影响。"}
              </p>
              <Failure error={change.error} />
              <footer>
                <Action onClick={() => setConfirm(null)}>取消</Action>
                <Action
                  disabled={change.isPending}
                  onClick={() => change.mutate(confirm.run)}
                >
                  {confirm.label === "放弃未保存的修改" ? "放弃修改" : "确认"}
                </Action>
              </footer>
            </Modal>
          )}
        </Modal>
      )}
    </section>
  );
}
const JoinInfo = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  member: z.boolean(),
});
export function JoinLink({
  token,
  user,
  onClose,
  onJoined,
}: {
  token: string;
  user: string;
  onClose: () => void;
  onJoined: (slug: string) => void;
}) {
  async function join(accept: boolean) {
    const r = await teamFetch(location.origin + "/api/invitations/join-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, accept }),
    });
    if (!r.ok) throw Error("邀请不可用");
    return JoinInfo.parse(await r.json());
  }
  const info = useTeamQuery(["join-preview", user, token], () => join(false));
  const accept = useTeamAction(async () => onJoined((await join(true)).slug));
  return (
    <Modal title="接受邀请" onClose={onClose}>
      <Failure error={info.error || accept.error} />
      {info.data && (
        <>
          <h3>{info.data.name}</h3>
          <p>当前身份 · {user}</p>
          <Action
            disabled={accept.isPending}
            onClick={() =>
              info.data!.member ? onJoined(info.data!.slug) : accept.mutate()
            }
          >
            {info.data.member ? "进入团队" : "加入团队"}
          </Action>
        </>
      )}
      <Action onClick={onClose}>关闭</Action>
    </Modal>
  );
}
