import { allProjectIssues } from "./project-issues";
import {taskRequirementsBody} from "./project-requirements";
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
  const live=useTeamQuery(["issues","project",issue.project_id],()=>allProjectIssues(issue.project_id!),!!issue.project_id);
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
  const openTask=(id:string)=>navigate(`/team/${workspace.slug}/issue/${id}?project=${issue.project_id}&section=tasks`,{state:{taskIds:live.data?.map(i=>i.id)}});
  const upstream = inputs.map(edge => {
    const source = graph?.nodes.find(n => n.id === edge.from);
    const task = live.data?.find(i => i.id === source?.issue_id);
    return {id:edge.from, title:task?.title || source?.title, task};
  });
  const waiting = upstream.filter(({task}) => task?.status !== "done");
  if(!node) return <Failure error={versions.error}/>;
  return (
    <div className="project-task-context" aria-label="项目交付关系">
      {inputs.length>0 && <section className="project-task-handoff"><h3>前置交付</h3>
        <ul>{upstream.map(({id, title, task}) =>
          <li key={id}>{task ? <button type="button" onClick={()=>openTask(task.id)}>{title}</button> : <strong>{title}</strong>}
            <small>{!live.data ? "正在读取" : !task ? "前置任务不在当前项目" : task.status === "done" ? "已交付" : "等待前置交付"}</small>
          </li>)}</ul>
        {live.data && <p>{waiting.length ? "等待前置交付：" + waiting.map(i=>i.title).join("、") : "前置交付已完成"}</p>}
      </section>}
      <Failure error={live.error}/>
      <Failure error={state.error || versions.error} />
      {issue.status === "done" && issue.project_id && (
        <section className="project-task-handoff">
          <h3>{text("project.directDownstream")}</h3>
          {(state.data?.items || [])
            .filter((i) => i.predecessor_ids.includes(issue.id))
            .map((i) => (
              <div key={i.issue_id}>
                <Action onClick={()=>openTask(i.issue_id)}>{i.title}</Action>
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
