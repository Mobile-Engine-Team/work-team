import { useSearchParams } from "react-router-dom";
import { teamApi, text, useTeamQuery } from "./client";
import { Action, Failure } from "./ui";
import { CollapsibleMessage } from "./collapsible-message";
export function TopicBlueprintContext({ projectID }: { projectID: string }) {
  const [params, setParams] = useSearchParams(),
    id = params.get("topic");
  const topics = useTeamQuery(
    ["topics", projectID],
    () => teamApi.listProjectTopics(projectID),
    !!id,
  );
  const topic = topics.data?.topics.find((t) => t.id === id);
  if (!id) return null;
  return (
    <section className="project-conclusion">
      <Failure error={topics.error} />
      <strong>
        {text("project.sourceTopic")} · {topic?.title}
      </strong>
      <p>
        {text("project.conclusionVersion")} {topic?.conclusion_revision || 0}
      </p>
      <CollapsibleMessage
        key={`${id}:${topic?.conclusion_revision}`}
        previewHeight={160}
        expandLabel="expandFullText"
        content={topic?.conclusion || text("project.noConfirmedConclusion")}
      />
      <p>{text("project.unrelatedTopicHint")}</p>
      <div className="team-actions" style={{ flexWrap: "wrap" }}>
        <Action
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set("section", "discussion");
            setParams(next);
          }}
        >
          {text("project.openTopic")}
        </Action>
        <Action
          onClick={() => {
            const next = new URLSearchParams(params);
            next.delete("topic");
            setParams(next);
          }}
        >
          {text("project.clearTopicContext")}
        </Action>
      </div>
    </section>
  );
}
