import { Progress } from "./progress";
import { CollapsibleMessage } from "./collapsible-message";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import type { Issue, Project } from "@multica/core/types";
import type { ProjectTopic } from "@multica/core/types/project-blueprint";
import { teamApi, text, useTeam, useTeamQuery, useTeamAction } from "./client";
import { Action, Failure, Field, Modal, Picker, Textarea, Status } from "./ui";
import { NewTask, useTeamPeople } from "./tasks";
import { TimelineComposer } from "./timeline";
import { RunList } from "./task-files";
import { personalRuns, sharedTimeline, locate } from "./relations";
import { TeamMarkdown } from "./markdown";

export function TopicConversation({ issueID }: { issueID: string }) {
 const [params] = useSearchParams();
 const commentID = params.get("comment");
  const people = useTeamPeople(),
    { user } = useTeam();
  const issue = useTeamQuery(
    ["issue", issueID],
    () => teamApi.getIssue(issueID),
    !!issueID,
  );
  const timeline = useTeamQuery(
    ["timeline", issueID],
    () => teamApi.listTimeline(issueID),
    !!issueID,
  );
  const runs = useTeamQuery(
    ["runs", issueID],
    () => teamApi.listTasksByIssue(issueID),
    !!issueID,
  );
  useEffect(() => { if (commentID && timeline.data) locate(`comment-${commentID}`); }, [commentID, !!timeline.data]);
  const visibleRuns = personalRuns(runs.data || [], user.id),
    entries = sharedTimeline(timeline.data || [], visibleRuns);
  return (
    <>
      <Failure error={issue.error || timeline.error || runs.error} />
      {issue.data && (
        <>
          <RunList
            issueId={issueID}
            people={people}
            runs={visibleRuns}
            entries={entries}
            error={runs.error}
          />
          <TimelineComposer
            heading={text("project.discussionRecord")}
            issue={issue.data}
            entries={entries}
            people={people}
            runs={visibleRuns}
          />
        </>
      )}
    </>
  );
}

export function TopicConclusion({
  project,
  topic,
  issues,
  editing,
  onClose,
  onOpen,
}: {
  project: Project;
  topic: ProjectTopic;
  issues: Issue[];
  editing: boolean;
  onClose: () => void;
  onOpen: (id: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const people = useTeamPeople();
  const [creationSource, setCreationSource] = useState<{
    project: Pick<Project, "id" | "title">;
    topicID: string;
    topicTitle: string;
    revision: number;
    conclusion: string;
  } | null>(null);
  const followups = useTeamQuery(
    ["topics", project.id, topic.id, "followups"],
    () => teamApi.listTopicFollowups(project.id, topic.id),
  );
  const [kind, setKind] = useState(""),
    [description, setDescription] = useState(""),
    [issueID, setIssueID] = useState(""),
    [key, setKey] = useState(() => crypto.randomUUID());
  const action = useTeamAction(async () => {
    await teamApi.createTopicFollowup(project.id, topic.id, {
      request_id: key,
      revision: topic.conclusion_revision,
      kind,
      description,
      issue_id: issueID,
    });
    setKey(crypto.randomUUID());
    setKind("");
    setDescription("");
    if (kind === "blueprint") {
      const next = new URLSearchParams(params);
      next.set("section", "blueprint");
      next.set("topic", topic.id);
      setParams(next);
    }
  });
  const current =
    followups.data?.items.filter(
      (f) => f.revision === topic.conclusion_revision,
    ) || [];
  const arranged = current.filter((f) => f.issue_id || f.kind === "record");
  const completion =
    arranged.length > 0 &&
    !current.some((f) => f.kind === "blueprint" && !f.implemented) &&
    arranged.every((f) => f.kind === "record" || f.status === "done");
  const taskGroups = new Map<
    string,
    NonNullable<typeof followups.data>["items"]
  >();
  for (const f of followups.data?.items || [])
    if (f.issue_id)
      taskGroups.set(f.issue_id, [...(taskGroups.get(f.issue_id) || []), f]);
  const linked = new Set(taskGroups.keys());
  return (
    <section className="project-conclusion-work">
      <section className="project-conclusion">
        <h3>{text("project.currentConclusion")}</h3>
        {topic.conclusion_revision > 0 ? (
          <>
            <small>
              V{topic.conclusion_revision} ·{" "}
              {text("project.conclusionConfirmedAt")}{" "}
              {topic.conclusion_confirmed_at
                ? new Date(topic.conclusion_confirmed_at).toLocaleString()
                : text("notSet")}
            </small>
            <small>
              {text("project.conclusionCutoff")}{" "}
              {topic.conclusion_cutoff &&
                new Date(topic.conclusion_cutoff).toLocaleString()}
            </small>
            <CollapsibleMessage
              key={`${topic.id}:${topic.conclusion_revision}`}
              content={topic.conclusion}
            />
          </>
        ) : (
          <p>{text("project.noConclusion")}</p>
        )}
      </section>
      <section className="project-followup-section">
        <div className="project-section-heading">
          <h3>{text("project.followupWork")}</h3>
          {topic.conclusion_revision > 0 && (
            <small>
              {text(
                completion
                  ? "project.followupComplete"
                  : arranged.length
                    ? "project.followupArranged"
                    : "project.followupPending",
              )}
            </small>
          )}
        </div>
        <Failure error={followups.error} />
        {[...taskGroups.entries()].map(([id, sources]) => {
          const f = sources[sources.length - 1];
          return (
            <article className="project-followup-task" key={id}>
              <div>
                <strong>{f.title}</strong>
                <span>
                  {people.name(f.assignee_id || null)} ·{" "}
                  <Status value={f.status} /> · {text("project.dueDate")}：
                  {f.due_date || text("notSet")}
                </span>
                <details>
                  <summary>
                    {text("project.sourceVersions")}{" "}
                    {sources.map((s) => `V${s.revision}`).join(" / ")}
                  </summary>
                  {sources.map((s) => (
                    <div key={s.id}>
                      <strong>V{s.revision}</strong>
                      <TeamMarkdown content={s.conclusion} />
                    </div>
                  ))}
                </details>
              </div>
              <Action onClick={() => onOpen(id)}>{text("open")}</Action>
            </article>
          );
        })}
        {topic.issue_ids
          .filter((id) => !linked.has(id))
          .map((id) => (
            <article className="project-followup-task" key={id}>
              <span>
                {text("project.originalLinkedTask")} ·{" "}
                {issues.find((i) => i.id === id)?.title ||
                  text("project.linkedTask")}
              </span>
              <Action onClick={() => onOpen(id)}>{text("open")}</Action>
            </article>
          ))}
        {followups.data?.items
          .filter((f) => !f.issue_id)
          .map((f) => (
            <details key={f.id}>
              <summary>
                {text(`project.followup.${f.kind}`)} · V{f.revision}
              </summary>
              {f.description && <p>{f.description}</p>}
              <TeamMarkdown content={f.conclusion} />
            </details>
          ))}
        {topic.conclusion_revision > 0 && (
          <>
            <div className="project-actions">
              {["create", "link"].map((k) => (
                <Action
                  key={k}
                  onClick={() =>
                    k === "create"
                      ? setCreationSource({
                          project,
                          topicID: topic.id,
                          topicTitle: topic.title,
                          revision: topic.conclusion_revision,
                          conclusion: topic.conclusion,
                        })
                      : setKind(k)
                  }
                >
                  {text(`project.followup.${k}`)}
                </Action>
              ))}
            </div>
            <details>
              <summary>{text("project.otherFollowup")}</summary>
              <div className="project-actions">
                {["blueprint", "record"].map((k) => (
                  <Action key={k} onClick={() => setKind(k)}>
                    {text(`project.followup.${k}`)}
                  </Action>
                ))}
              </div>
            </details>
          </>
        )}
      </section>
      {editing && (
        <ConclusionEditor project={project} topic={topic} onClose={onClose} />
      )}
      {creationSource && (
        <NewTask
          followup={creationSource}
          onClose={() => setCreationSource(null)}
          onCreated={() => {
            setCreationSource(null);
            void followups.refetch();
          }}
        />
      )}
      {kind && (
        <Modal
          title={text(`project.followup.${kind}`)}
          onClose={() => {
            if (!action.isPending) setKind("");
          }}
        >
          <p>
            {project.title} · {text("project.conclusionVersion")}{" "}
            {topic.conclusion_revision}
          </p>
          <CollapsibleMessage
            key={`${topic.id}:${topic.conclusion_revision}`}
            content={topic.conclusion}
          />
          {kind === "link" && (
            <Picker
              label={text("project.linkedTask")}
              value={issueID}
              onChange={setIssueID}
              options={issues
                .filter((i) => !i.project_id || i.project_id === project.id)
                .map((i) => ({ value: i.id, label: i.title }))}
            />
          )}
          {kind !== "create" && (
            <Field label={text("project.followupInstructions")}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          )}
          <p>{text("project.followupNoStart")}</p>
          <Failure error={action.error} />
          <Action
            primary
            disabled={action.isPending || (kind === "link" && !issueID)}
            onClick={() => action.mutate()}
          >
            {text("save")}
          </Action>
        </Modal>
      )}
    </section>
  );
}
function ConclusionEditor({
  project,
  topic,
  onClose,
}: {
  project: Project;
  topic: ProjectTopic;
  onClose: () => void;
}) {
  const people = useTeamPeople(),
    { workspace } = useTeam();
  // Keep the opening revisions: remote updates cannot silently replace edited text.
  const [base] = useState({
    conclusion: topic.conclusion_revision,
    draft: topic.draft_revision,
  });
  const [value, setValue] = useState(
      topic.conclusion_draft || topic.conclusion,
    ),
    [agent, setAgent] = useState(""),
    [requestID, setRequestID] = useState(() => crypto.randomUUID());
  const requests = useQuery({
    queryKey: ["team", workspace.id, "blueprint", project.id, "planning"],
    queryFn: () => teamApi.listProjectPlanning(project.id),
    refetchInterval: (q) =>
      q.state.data?.requests.some(
        (r) => r.status === "running" || r.status === "queued",
      )
        ? 3000
        : false,
  });
  const [active, setActive] = useState("");
  const request = active
    ? requests.data?.requests.find((r) => r.id === active)
    : requests.data?.requests.find(
        (r) => r.purpose === "conclusion" && r.topic_id === topic.id,
      );
  const action = useTeamAction(async (mode: string) => {
    if (mode === "generate") {
      const result = await teamApi.requestProjectPlanning(project.id, {
        purpose: "conclusion",
        agent_id: agent,
        expected_revision: 0,
        request_id: requestID,
        instructions: "",
        selected_nodes: [],
        topic_id: topic.id,
      });
      setActive(result.id);
      setRequestID(crypto.randomUUID());
      return;
    }
    if (mode === "cancel" && request) {
      await teamApi.cancelProjectPlanning(project.id, request.id);
      return;
    }
    if (mode === "confirm")
      await teamApi.updateProjectTopic(project.id, topic.id, {
        conclusion: value,
        expected_revision: base.conclusion,
        draft: "",
        expected_draft_revision: base.draft,
      });
    else
      await teamApi.updateProjectTopic(project.id, topic.id, {
        draft: mode === "discard" ? "" : value,
        expected_draft_revision: base.draft,
      });
    onClose();
  });
  const submitting = action.isPending && action.variables === "generate";
  const waiting = !!active && !request && !requests.error;
  const generating =
    submitting ||
    waiting ||
    request?.status === "queued" ||
    request?.status === "running";
  return (
    <Modal
      wide
      className="team-conclusion-modal"
      title={text("project.organizeConclusion")}
      onClose={onClose}
    >
      <p>{text("project.conclusionReviewHint")}</p>
      <Field label={text("project.conclusionDraft")}>
        <Textarea
          rows={12}
          maxLength={10000}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </Field>
      <details className="team-conclusion-ai" open>
        <summary>{text("project.aiConclusion")}</summary>
        <div className="team-conclusion-ai-controls">
          <Field label={text("project.chooseAssistant")}>
            <Picker
              label={text("project.chooseAssistant")}
              value={agent}
              onChange={setAgent}
              disabled={generating || action.isPending}
              options={[
                { value: "", label: text("chooseAgent") },
                ...(people.agents.data || [])
                  .filter(people.allowed)
                  .map((a) => ({ value: a.id, label: a.name })),
              ]}
            />
          </Field>
          <Action
            disabled={!agent || action.isPending || generating}
            onClick={() => action.mutate("generate")}
          >
            {text("project.aiConclusion")}
          </Action>
        </div>
        <p className="team-draft-hint">{text("project.planningCost")}</p>
        {(submitting || active || request) && (
          <div className="team-conclusion-ai-status">
            <Progress active={generating && !requests.error}>
              {text(
                submitting
                  ? "draftStatus.submitting"
                  : requests.error
                    ? "draftStatus.unavailable"
                    : `project.planning.${request?.status || "queued"}`,
              )}
            </Progress>
            {request && (
              <time>{new Date(request.created_at).toLocaleString()}</time>
            )}
            {(request?.status === "queued" ||
              request?.status === "running") && (
              <Action
                size="sm"
                disabled={action.isPending}
                onClick={() => action.mutate("cancel")}
              >
                {text("cancel")}
              </Action>
            )}
          </div>
        )}
        {request?.error && <p role="alert">{request.error}</p>}
        {request?.conclusion_draft && (
          <>
            <TeamMarkdown content={request.conclusion_draft} />
            <Action
              onClick={() =>
                setValue((previous) =>
                  previous
                    ? previous + "\n\n" + request.conclusion_draft
                    : request.conclusion_draft || "",
                )
              }
            >
              {text("project.insertAIDraft")}
            </Action>
          </>
        )}
      </details>
      <Failure error={action.error || requests.error} />
      <div className="project-actions">
        <Action
          primary
          disabled={!value.trim() || action.isPending}
          onClick={() => action.mutate("confirm")}
        >
          {text("project.confirmConclusion")}
        </Action>
        <Action
          disabled={action.isPending}
          onClick={() => action.mutate("save")}
        >
          {text("project.keepDraft")}
        </Action>
        <Action
          disabled={action.isPending}
          onClick={() => action.mutate("discard")}
        >
          {text("project.discardDraft")}
        </Action>
      </div>
    </Modal>
  );
}
