import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTeam, useTeamAction } from "../team/client";
import { Action, Failure, Field, Input, Modal, Textarea } from "../team/ui";
import { IDSchema, request } from "./api";

export function WorkAction({
  kind,
  message,
  prompt,
}: {
  kind: string;
  message: string;
  prompt: string;
}) {
  const { workspace } = useTeam(),
    navigate = useNavigate();
  const [edit, setEdit] = useState(false),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(prompt);
  const create = useTeamAction(async () => {
    const task = await request(
      workspace.id,
      "/messages/" + message + "/task",
      IDSchema,
      { title: title.trim(), description },
    );
    setEdit(false);
    navigate("/team/" + workspace.slug + "/issue/" + task.id);
  });
  if (kind === "task")
    return (
      <>
        <Action onClick={() => setEdit(true)}>确认任务草案</Action>
        {edit && (
          <Modal title="确认任务草案" onClose={() => setEdit(false)}>
            <Field label="任务标题">
              <Input
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="任务描述">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Failure error={create.error} />
            <Action onClick={() => setEdit(false)}>取消</Action>
            <Action
              disabled={!title.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              创建任务
            </Action>
          </Modal>
        )}
      </>
    );
  const entry = (
    {
      invite: ["打开邀请成员", "settings&invite=1"],
      project: ["新建项目", "projects&create=1"],
      files: ["打开我的文件", "files"],
    } as Record<string, string[]>
  )[kind];
  return entry ? (
    <Action
      onClick={() => navigate("/team/" + workspace.slug + "?view=" + entry[1])}
    >
      {entry[0]}
    </Action>
  ) : null;
}
