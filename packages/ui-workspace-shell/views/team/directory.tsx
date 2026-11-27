import { useState } from "react";
import { ArrowRight, Bot, Crown, List, Monitor, Plus, Search, Sparkles, Users } from "../icons";
import { Grid2X2 } from "lucide-react";
import { Action } from "./ui";
import "./directory.css";

export interface DirectoryItem {
  id: string;
  name: string;
  description: string;
  owner: string;
  mine: boolean;
  first: string;
  second: string;
  status?: "在线" | "离线" | "已归档" | "状态未知";
  builtin?: boolean;
  archived?: boolean;
  members?: number;
  people?: {id:string;label:string;agent:boolean}[];
  squadCount?:number;
  avatar?: string | null;
}

export function Directory({
  kind,
  items,
  scope,
  onScope,
  onCreate,
  onOpen,
  loading,
}: {
  kind: "智能体" | "小队";
  items: DirectoryItem[];
  scope: string;
  onScope: (scope: string) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("全部状态");
  const [layout, setLayout] = useState("grid");
  const squads = kind === "小队";
  const Icon = squads ? Users : Bot;
  const all = "全部" + kind;
  const scopes = squads ? [all, "我创建的"] : [all, "我的", "已归档"];
  const visible = items.filter((item) => {
    if (!!item.archived !== (scope === "已归档")) return false;
    if (scope !== all && scope !== "已归档" && !item.mine) return false;
    if (
      !squads &&
      scope !== "已归档" &&
      status !== "全部状态" &&
      item.status !== status
    )
      return false;
    return [item.name, item.description, item.second]
      .join(" ")
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase());
  });
  function clear() {
    setSearch("");
    setStatus("全部状态");
  }
  const filtered = !!search || status !== "全部状态";
  return (
    <section className="mw-directory">
      <header>
        <h1>{squads ? "智能体小队" : kind}</h1>
        <Action primary onClick={onCreate}>
          <Plus size={16} />
          创建{kind}
        </Action>
      </header>
      <div className="directory-toolbar">
        <div className="directory-scopes" role="group" aria-label="查看范围">
          {scopes.map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={scope === value}
              onClick={() => onScope(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="directory-filters">
          <label>
            <Search size={16} />
            <input
              aria-label={"搜索" + kind}
              placeholder={
                squads ? "搜索小队名称、描述" : "搜索名称、描述或模型"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {!squads && scope !== "已归档" && (
            <select
              aria-label="状态筛选"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["全部状态", "在线", "离线"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          )}
          <div className="directory-layout">
            {[
              ["grid", "卡片视图"],
              ["list", "列表视图"],
            ].map(([value, name]) => (
              <button
                type="button"
                key={value}
                aria-label={name}
                aria-pressed={layout === value}
                onClick={() => setLayout(value)}
              >
                {value === "grid" ? <Grid2X2 size={16} /> : <List size={16} />}
              </button>
            ))}
          </div>
        </div>
      </div>
      {loading ? (
        <p role="status">加载中…</p>
      ) : (
        <>
          <div className="directory-count">
            {visible.length} 个{kind}
            {!squads && scope !== "已归档" && (
              <span>
                ●　{visible.filter((i) => i.status === "在线").length} 个在线
              </span>
            )}
          </div>
          {!visible.length ? (
            <div className="directory-empty">
              <Icon size={36} />
              <h2>
                {filtered
                  ? "没有找到匹配结果"
                  : scope === "已归档"
                    ? "暂无已归档智能体"
                    : "这里还没有" + kind}
              </h2>
              <p>
                {filtered
                  ? "试试其他关键词，或清除筛选条件。"
                  : "创建你的协作者，开始组织工作。"}
              </p>
              <Action onClick={filtered ? clear : onCreate}>
                {filtered ? "清除筛选" : "创建" + kind}
              </Action>
            </div>
          ) : layout === "grid" ? (
            <div className="directory-grid">
              {visible.map((i) => (
                <button
                  key={i.id}
                  className="directory-card"
                  onClick={() => onOpen(i.id)}
                >
                  <div className="directory-card-top">
                    <b className="directory-icon">
                      {i.avatar ? (
                        <img src={i.avatar} width={22} height={22} alt="" />
                      ) : (
                        <Icon size={22} />
                      )}
                    </b>
                    <h2>{i.name}</h2>
                    <small data-status={squads?undefined:i.status}>
                      {squads ? i.members + " 位" : i.status}
                    </small>
                  </div>
                  <p>{i.description || "尚未添加描述"}</p>
                  {squads ? <>
                    <div className="directory-leader"><Crown size={16}/><span>队长</span><b aria-hidden="true"><Bot size={16}/></b><strong>{i.first}</strong></div>
                    <div className="directory-members">{i.people?.slice(0,5).map(person=><span key={person.id} data-human={!person.agent} title={person.label}>{person.agent?<Bot size={13}/>:person.label.slice(0,1)}</span>)}<small>{i.members} 位成员</small></div>
                  </> : <>
                    <div className="directory-tags">{i.builtin && <span>系统内置</span>}</div>
                    <div className="directory-meta"><span><Monitor size={14}/>{i.first}</span><span><Sparkles size={14}/>{i.second}</span></div>
                  </>}
                  <footer>
                    <span>{i.mine ? "我创建的" : i.owner + " 创建"}{i.squadCount!==undefined&&" · "+i.squadCount+" 个小队"}</span>
                    <span>
                      {squads ? "查看小队" : "查看详情"}{" "}
                      <ArrowRight size={13} />
                    </span>
                  </footer>
                </button>
              ))}
            </div>
          ) : (
            <div className="directory-table">
              <table>
                <thead>
                  <tr>
                    {[
                      kind,
                      squads ? "队长" : "状态",
                      squads ? "成员" : "运行时",
                      squads ? "创建者" : "模型",
                      "",
                    ].map((s, n) => (
                      <th key={n}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <button onClick={() => onOpen(i.id)}>
                          <Icon size={18} />
                          {i.name}
                        </button>
                        <small>{i.description}</small>
                      </td>
                      <td>{squads ? i.first : i.status}</td>
                      <td>{squads ? i.members + " 位成员" : i.first}</td>
                      <td>{squads ? i.owner : i.second}</td>
                      <td>
                        <button
                          aria-label={"查看" + i.name}
                          onClick={() => onOpen(i.id)}
                        >
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
