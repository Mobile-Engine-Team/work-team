import { Bell, Copy, MoreHorizontal, Pencil, Pin, Plus, Trash2 } from "../icons";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useState } from "react";
import type { Issue, UpdateIssueRequest } from "@multica/core/types";
import { teamApi, useTeam, useTeamAction, useTeamQuery } from "./client";
import { Action, Field, Failure, Modal, Picker } from "./ui";

import { TaskTableLabels } from "./task-table-labels";
import { TaskDate } from "./task-date";

export async function copyIssue(issue: Issue) {
    const current = await teamApi.listLabelsForIssue(issue.id);
    return teamApi.createIssue({
      title: issue.title + "（副本）",
      description: issue.description || "",
      priority: issue.priority,
      status: issue.status,
      project_id: issue.project_id || undefined,
      assignee_type: issue.assignee_type || undefined,
      assignee_id: issue.assignee_id || undefined,
      start_date: issue.start_date || undefined,
      due_date: issue.due_date || undefined,
      label_ids: current.labels.map((l) => l.id),
      suppress_run: true,
    });
}

export function TaskProperties({issue}: {issue: Issue}) {
  const [expanded, setExpanded] = useState(false);
  const projects = useTeamQuery(["projects"], () => teamApi.listProjects());
  const assigned = useTeamQuery(["issue-labels", issue.id], () =>
    teamApi.listLabelsForIssue(issue.id),
  );
  const update = useTeamAction((patch: UpdateIssueRequest) =>
    teamApi.updateIssue(issue.id, {
      ...patch,
      suppress_run: true,
      expected_revision: issue.revision,
    }),
  );
  return (
    <section className="team-task-properties" aria-label="任务属性与操作">
      <div className="team-two-fields">
        <Field label="项目">
          <Picker
            label="所属项目"
            value={issue.project_id || ""}
            options={[
              { value: "", label: "无关联项目" },
              ...(projects.data?.projects || []).map((p) => ({
                value: p.id,
                label: p.title,
              })),
            ]}
            onChange={(v) => update.mutate({ project_id: v || null })}
          />
        </Field>
        <Field label="优先级">
          <Picker
            label="优先级"
            value={issue.priority}
            options={["none", "low", "medium", "high", "urgent"].map(
              (value, i) => ({
                value,
                label: ["无优先级", "低", "中", "高", "紧急"][i],
              }),
            )}
            onChange={(v) =>
              update.mutate({ priority: v as Issue["priority"] })
            }
          />
        </Field>
        <Field label="截止日期">
          <TaskDate
            label="详情截止日期"
            value={issue.due_date || ""}
            min={issue.start_date || undefined}
            onChange={(day) =>
              update.mutate({ due_date: day || null })
            }
          />
        </Field>
      </div>
      <button className="v3-issue-extra-toggle" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Plus size={13}/>{expanded ? "收起属性" : "更多属性"}</button>
      {expanded && <div className="v3-issue-extra"><Field label="开始日期">
          <TaskDate
            label="详情开始日期"
            value={issue.start_date || ""}
            max={issue.due_date || undefined}
            onChange={(day) =>
              update.mutate({ start_date: day || null })
            }
          />
        </Field>
        <Field label="标签">
          <TaskTableLabels id={issue.id} identifier={issue.identifier} revision={assigned.data ? issue.revision : undefined}
            names={assigned.data?.labels.map(label => label.name) || []} label="详情任务标签" placeholder="用逗号分隔"/>
        </Field>
      </div>}
      <Failure
        error={
          update.error ||
          projects.error ||
          assigned.error
        }
      />
    </section>
  );
}

export function TaskDetailMenu({issue, onEdit, onWake, onCopy, onDelete}: {
  issue: Issue; onEdit: () => void; onWake: () => void; onCopy: (id:string) => void; onDelete: () => void;
}) {
  const { user } = useTeam();
  const [deleting, setDeleting] = useState(false);
  const pins = useTeamQuery(["task-pins",user.id], () => teamApi.listPins());
  const pinned = pins.data?.some(p => p.item_type === "issue" && p.item_id === issue.id);
  const pin = useTeamAction(async () => {
    if (pinned) await teamApi.deletePin("issue",issue.id);
    else await teamApi.createPin({item_type:"issue",item_id:issue.id});
    await pins.refetch();
  });
  const copy = useTeamAction(async () => onCopy((await copyIssue(issue)).id));
  const remove = useTeamAction(async () => {
    await teamApi.deleteIssue(issue.id);
    onDelete();
  });
  const clipboard = useTeamAction(() =>
    navigator.clipboard.writeText(issue.identifier),
  );
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger render={<button aria-label="任务操作" title="任务操作"/>}><MoreHorizontal size={16}/></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}><Pencil size={15}/>编辑任务</DropdownMenuItem>
        <DropdownMenuItem disabled={!pins.data || pin.isPending} onClick={()=>pin.mutate()}><Pin size={15}/>{pinned ? "取消置顶" : "置顶任务"}</DropdownMenuItem>
        <DropdownMenuItem disabled={copy.isPending} onClick={()=>copy.mutate()}><Copy size={15}/>复制任务</DropdownMenuItem>
        <DropdownMenuItem onClick={()=>clipboard.mutate()}><Copy size={15}/>{clipboard.isSuccess ? "已复制任务编号" : "复制任务编号"}</DropdownMenuItem>
        <DropdownMenuItem onClick={onWake}><Bell size={15}/>添加唤醒</DropdownMenuItem>
        <DropdownMenuItem onClick={()=>setDeleting(true)}><Trash2 size={15}/>删除任务</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Failure error={pins.error || pin.error || copy.error || clipboard.error}/>
      {deleting && (
        <Modal title="删除任务" onClose={() => setDeleting(false)}>
          <p>确认删除「{issue.title}」？下属任务将保留。</p>
          <Action onClick={() => setDeleting(false)}>取消</Action>
          <Action disabled={remove.isPending} onClick={() => remove.mutate()}>
            确认删除
          </Action>
          <Failure error={remove.error} />
        </Modal>
      )}
  </>;
}
