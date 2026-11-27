import { taskRequirementsBody } from "./project-requirements";
import { CollapsibleMessage } from "./collapsible-message";
import { useState } from "react";
import { ProjectStart } from "./project-planning";
import { useTeamPeople } from "./tasks";
import { useNavigate } from "react-router-dom";
import type { Issue } from "@multica/core/types";
import { teamApi, text, useTeam, useTeamQuery } from "./client";
import { Action, Failure } from "./ui";
export function TaskProjectContext({ issue }: { issue: Issue }) {
  const [handoff, setHandoff] = useState(false);
  const people = useTeamPeople();
  const { workspace } = useTeam(),
    navigate = useNavigate();
  const topics = useTeamQuery(["topics", "issue", issue.id], () =>
    teamApi.listIssueProjectTopics(issue.id),
  );
  const state = useTeamQuery(
    ["blueprint", issue.project_id, "start"],
    () => teamApi.getProjectStartState(issue.project_id!),
    !!issue.project_id,
  );
  const versions = useTeamQuery(
    ["blueprint", issue.project_id, "versions"],
    () => teamApi.listBlueprintVersions(issue.project_id!),
    !!issue.project_id,
  );
  const graph = versions.data?.versions[0]?.graph,
    node = graph?.nodes.find((n) => n.issue_id === issue.id),
    inputs = graph?.edges.filter((e) => e.to === node?.id) || [];
  const open = (id: string, section: string, topic = "") =>
    navigate(
      `/team/${workspace.slug}?view=projects&project=${id}&section=${section}${topic ? `&topic=${topic}` : ""}`,
    );
  return (
    <div className="project-task-context">
      <Failure error={topics.error} />
      {inputs.length > 0 && (
        <p>
          {text("project.predecessors")}：
          {inputs
            .map((e) => graph?.nodes.find((n) => n.id === e.from)?.title)
            .join("、")}{" "}
          ·{" "}
          {state.data?.items.find((i) => i.issue_id === issue.id)?.reason ||
            text("project.dependencyEntryHint")}
        </p>
      )}
      <Failure error={state.error || versions.error} />
      {issue.status === "done" && issue.project_id && (
        <section className="project-task-handoff">
          <h3>{text("project.directDownstream")}</h3>
          {(state.data?.items || [])
            .filter((i) => i.predecessor_ids.includes(issue.id))
            .map((i) => (
              <div key={i.issue_id}>
                <strong>{i.title}</strong>
                <span>
                  {text("project.assignee")}：
                  {people.name(i.assignee_id || null)}
                </span>
                <small>{i.reason || text("project.readyToStart")}</small>
              </div>
            ))}
          {state.data &&
            !state.data.items.some((i) =>
              i.predecessor_ids.includes(issue.id),
            ) && <p>{text("project.noDownstream")}</p>}
          {state.data?.items.some((i) =>
            i.predecessor_ids.includes(issue.id),
          ) && (
            <Action onClick={() => setHandoff(true)}>
              {text("project.viewHandoff")}
            </Action>
          )}
        </section>
      )}
      {handoff && issue.project_id && (
        <ProjectStart
          project={{ id: issue.project_id }}
          predecessorId={issue.id}
          onClose={() => setHandoff(false)}
        />
      )}
      {!!topics.data?.topics.length && (
        <section className="team-decision-basis">
          <h3>{text("decisionBasis")}</h3>
          <p>{text("adoptedVersionHint")}</p>
          {topics.data.topics.map((t) => (
            <section key={t.id}>
              <Action onClick={() => open(t.project_id, "discussion", t.id)}>
                {text("project.openTopic")} · {t.title}
              </Action>
              {t.adopted_versions.length
                ? t.adopted_versions.map((v) => (
                    <div key={v.revision}>
                      <strong>
                        {text("project.sourceVersions")} V{v.revision}
                      </strong>
                      <p>
                        <small>
                          {text("project.conclusionConfirmedAt")}{" "}
                          {new Date(v.confirmed_at).toLocaleString()}
                        </small>
                      </p>
                      <CollapsibleMessage content={v.content} />
                    </div>
                  ))
                : t.adopted_conclusions && (
                    <CollapsibleMessage content={t.adopted_conclusions} />
                  )}
            </section>
          ))}
        </section>
      )}
    </div>
  );
}

export function TaskRequirements({ issue }: { issue: Issue }) {
  const topics = useTeamQuery(["topics", "issue", issue.id], () =>
    teamApi.listIssueProjectTopics(issue.id),
  );
  const content = taskRequirementsBody(
    issue.description || "",
    (topics.data?.topics || []).flatMap((topic) =>
      topic.adopted_versions.map((v) => v.content),
    ),
  );
  return <CollapsibleMessage content={content || text("noDescription")} />;
}
