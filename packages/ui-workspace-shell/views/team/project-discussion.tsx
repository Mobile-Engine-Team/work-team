import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, MessageSquare } from "lucide-react";
import type { Issue, Project } from "@multica/core/types";
import { teamApi, text, useTeamAction, useTeamQuery } from "./client";
import { Action, Failure, Field, Input, Modal, Textarea } from "./ui";
import { TopicConversation, TopicConclusion } from "./topic-conclusion";
export function ProjectDiscussion({
  project,
  issues,
  onOpen,
}: {
  project: Project;
  issues: Issue[];
  onOpen: (id: string) => void;
}) {
  const [params, setParams] = useSearchParams(),
    topicID = params.get("topic") || "";
  const candidates = useTeamQuery(
    ["issues", "project-topic-candidates", project.id],
    () => teamApi.listIssues({ limit: 100 }),
  );
  const topics = useTeamQuery(["topics", project.id], () =>
    teamApi.listProjectTopics(project.id),
  );
  const selected =
    topics.data?.topics.find((t) => t.id === topicID) || topics.data?.topics[0];
  const [creating, setCreating] = useState(false),
    [title, setTitle] = useState(""),
    [body, setBody] = useState(""),
    [editingConclusion, setEditingConclusion] = useState(false);
  const [requestID, setRequestID] = useState(() => crypto.randomUUID());
  const action = useTeamAction(async (mode: string) => {
    if (mode === "create") {
      const t = await teamApi.createProjectTopic(project.id, {
        title,
        content: body,
        issue_ids: [],
        request_id: requestID,
      });
      setCreating(false);
      setTitle("");
      setBody("");
      setRequestID(crypto.randomUUID());
      const next = new URLSearchParams(params);
      next.set("topic", t.id);
      setParams(next);
    }
    if (mode === "resolve" && selected)
      await teamApi.updateProjectTopic(project.id, selected.id, {
        status: selected.status === "resolved" ? "open" : "resolved",
      });
  });
  return (
    <div className="project-discussion">
      <aside className="project-topic-sidebar">
        <div className="project-section-heading">
          <h3>{text("project.topics")}</h3>
          <Action
            onClick={() => setCreating(true)}
            aria-label={text("project.newTopic")}
          >
            <Plus size={17} />
          </Action>
        </div>
        {topics.data?.topics.map((t) => (
          <button
            className={selected?.id === t.id ? "active" : ""}
            key={t.id}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("topic", t.id);
              setParams(next);
            }}
          >
            <MessageSquare size={16} />
            <span>
              <strong>{t.title}</strong>
              <small>
                {text(`project.topic.${t.status}`)} · {t.issue_ids.length}{" "}
                {text("project.linkedTasks")}
              </small>
            </span>
          </button>
        ))}
      </aside>
      <div className="project-topic-content">
        <Failure error={topics.error || action.error} />
        {selected ? (
          <>
            <div className="project-section-heading project-topic-heading">
              <h2>{selected.title}</h2>
              <div className="project-topic-actions">
                <Action primary onClick={() => setEditingConclusion(true)}>
                  {text("project.organizeConclusion")}
                </Action>
                <Action
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("section", "blueprint");
                    next.set("topic", selected.id);
                    setParams(next);
                  }}
                >
                  {text("project.topicToDraft")}
                </Action>
                <Action
                  onClick={() => action.mutate("resolve")}
                  disabled={action.isPending}
                >
                  {text(
                    selected.status === "resolved"
                      ? "project.reopen"
                      : "project.resolve",
                  )}
                </Action>
              </div>
            </div>
            <TopicConclusion
              key={selected.id}
              project={project}
              topic={selected}
              issues={candidates.data?.issues || issues}
              editing={editingConclusion}
              onClose={() => setEditingConclusion(false)}
              onOpen={onOpen}
            />
            <TopicConversation
              key={selected.discussion_issue_id}
              issueID={selected.discussion_issue_id}
            />
          </>
        ) : (
          <div className="project-empty">
            <MessageSquare size={36} />
            <h3>{text("project.noTopics")}</h3>
            <Action primary onClick={() => setCreating(true)}>
              {text("project.newTopic")}
            </Action>
          </div>
        )}
      </div>
      {creating && (
        <Modal
          title={text("project.newTopic")}
          onClose={() => setCreating(false)}
        >
          <Field label={text("project.topicTitle")}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={text("project.content")}>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
            />
          </Field>
          <Failure error={action.error} />
          <Action
            primary
            disabled={!title.trim() || action.isPending}
            onClick={() => action.mutate("create")}
          >
            {text("project.createTopic")}
          </Action>
        </Modal>
      )}
    </div>
  );
}
