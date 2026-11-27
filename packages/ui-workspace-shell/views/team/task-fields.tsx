import type { Project } from "@multica/core/types";
import type { TeamDraft } from "./draft";
import { teamApi, text, useTeamQuery } from "./client";
import { Field, Input, Textarea, Picker, SearchPicker, Failure } from "./ui";
import { UploadFiles } from "./task-files";

type Option = { value: string; label: string; disabled?: boolean };
export function TaskFields({
  draft,
  update,
  owners,
  statuses,
  project,
  onUploading,
  onUploadFailure,
}: {
  draft: TeamDraft;
  update: (patch: Partial<TeamDraft>) => void;
  owners: Option[];
  statuses: Option[];
  project?: Pick<Project, "id" | "title">;
  onUploading: (value: boolean) => void;
  onUploadFailure: (value: boolean) => void;
}) {
  const projects = useTeamQuery(["projects"], () => teamApi.listProjects());
  return (
    <>
      {
        <Field label={text("taskTitle")}>
          <Input
            autoFocus
            maxLength={500}
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </Field>
      }
      <Field label={text("requirements")}>
        <Textarea
          rows={4}
          maxLength={12000}
          value={draft.description}
          onChange={(e) => update({ description: e.target.value })}
        />
      </Field>
      <div className="team-two-fields">
        <Field label={text("owner")}>
          <Picker
            label={text("owner")}
            value={draft.owner}
            options={owners}
            onChange={(owner) => update({ owner })}
          />
        </Field>
        {
          <Field label={text("state")}>
            <Picker
              label={text("state")}
              value={draft.status}
              options={statuses}
              onChange={(status) => update({ status })}
            />
          </Field>
        }
      </div>
      {
        <div className="team-two-fields">
          <Field label="优先级">
            <Picker
              label="优先级"
              value={draft.priority}
              options={[
                { value: "none", label: "无优先级" },
                { value: "low", label: "低" },
                { value: "medium", label: "中" },
                { value: "high", label: "高" },
                { value: "urgent", label: "紧急" },
              ]}
              onChange={(priority) =>
                update({ priority: priority as TeamDraft["priority"] })
              }
            />
          </Field>
          <Field label={text("taskProject")}>
            {project ? (
              <Input readOnly value={project.title} />
            ) : (
              <SearchPicker
                label={text("taskProject")}
                value={draft.projectID}
                onChange={(projectID) => update({ projectID })}
                options={[
                  { value: "", label: text("noProject") },
                  ...(projects.data?.projects || []).map((p) => ({
                    value: p.id,
                    label: p.title,
                  })),
                ]}
              />
            )}
          </Field>
        </div>
      }
      <details>
        <summary>更多选项</summary>
        <div className="team-two-fields">
          <Field label="开始日期">
            <Input
              type="date"
              value={draft.startDate}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </Field>
          <Field label={text("project.dueDate")}>
            <Input
              type="date"
              value={draft.dueDate}
              onChange={(e) => update({ dueDate: e.target.value })}
            />
          </Field>
        </div>
        {draft.dueDate && draft.startDate > draft.dueDate && (
          <p role="alert">截止日期不能早于开始日期</p>
        )}
        <Field label="标签">
          <Input
            placeholder="用逗号分隔标签"
            value={draft.labels}
            onChange={(e) => update({ labels: e.target.value })}
          />
        </Field>
      </details>
      <Failure error={projects.error} />
      <UploadFiles
        files={draft.files}
        onChange={(files) => update({ files })}
        onPendingChange={onUploading}
        onFailureChange={onUploadFailure}
      />
    </>
  );
}
