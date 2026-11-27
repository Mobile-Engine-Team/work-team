import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { teamFetch } from "./request-transport";
import { useTeam } from "./client";
import { Failure } from "./ui";
const Receipt = z.object({
  request_id: z.string(),
  issue_id: z.string(),
  handoff: z.string(),
  execution: z.string().nullable(),
  title: z.string(),
  reason: z.string().nullable(),
  version: z.number().nullable(),
});
export function ProjectReceipts({ project }: { project: string }) {
  const { workspace } = useTeam();
  const rows = useQuery({
    queryKey: ["team", workspace.id, "handoff", project],
    queryFn: async () => {
      const r = await teamFetch(
        location.origin + "/api/projects/" + project + "/receipts",
        { headers: { "X-Workspace-ID": workspace.id } },
      );
      if (!r.ok) throw Error("无法读取交接回执");
      return Receipt.array().parse(await r.json());
    },
    refetchInterval: 3000,
  });
  const labels: Record<string, string> = {
    failed: "失败",
    notified: "站内通知已送达",
    queued: "已入队",
    running: "执行中",
    completed: "执行完成",
    cancelled: "已取消",
    claimed: "执行端已领取",
  };
  if(!rows.data?.length && !rows.error) return null;
  return (
    <details>
      <summary>交接历史（{rows.data?.length || 0}）</summary>
      <Failure error={rows.error} />
      {rows.data?.map((r) => (
        <p key={r.issue_id + r.request_id}>
          {r.title} · V{r.version || "—"} · {labels[r.handoff] || r.handoff}
          {r.execution && " · " + (labels[r.execution] || r.execution)}{" "}
          {r.reason}
        </p>
      ))}
    </details>
  );
}
