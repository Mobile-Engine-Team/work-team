import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { teamApi, useTeam, useTeamQuery } from "./client";
import { Action, Empty, Failure, Input, Status } from "./ui";

export function AssignedWork({ id }: { id: string }) {
  const { workspace } = useTeam(),
    navigate = useNavigate();
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(0);
  const tasks = useTeamQuery(["assigned-work", id, search, page], () =>
    teamApi.listIssues({
      workspace_id: workspace.id,
      assignee_id: id,
      q: search,
      limit: 25,
      offset: 25 * page,
    }),
  );
  return (
    <section>
      <h2>全部工作</h2>
      <Input
        aria-label="搜索工作"
        placeholder="搜索任务名称"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(0);
        }}
      />
      <Failure error={tasks.error} retry={() => void tasks.refetch()} />
      {tasks.isPending && <p role="status">加载中…</p>}
      {tasks.data?.issues.map((issue) => (
        <button
          className="directory-issue"
          key={issue.id}
          onClick={() =>
            navigate("/team/" + workspace.slug + "/issue/" + issue.id)
          }
        >
          {issue.title}
          <Status value={issue.status} />
        </button>
      ))}
      {tasks.data?.total === 0 && (
        <Empty>{search ? "没有匹配的工作" : "暂无任务"}</Empty>
      )}
      {!!tasks.data && tasks.data.total > 25 && (
        <div className="team-actions">
          <Action disabled={!page} onClick={() => setPage(page - 1)}>
            上一页
          </Action>
          <span>
            {page + 1} / {Math.ceil(tasks.data.total / 25)}
          </span>
          <Action
            disabled={(page + 1) * 25 >= tasks.data.total}
            onClick={() => setPage(page + 1)}
          >
            下一页
          </Action>
        </div>
      )}
    </section>
  );
}

export function ObjectLinks({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("已复制");
    } catch {
      setMessage("复制失败");
    }
  }
  return (
    <span className="team-actions">
      <Action onClick={() => void copy(location.href)}>复制链接</Action>
      <Action onClick={() => void copy(id)}>复制 ID</Action>
      <small role="status">{message}</small>
    </span>
  );
}
