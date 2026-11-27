import {
  deduplicateInboxItems,
  deduplicateArchivedInboxItems,
} from "@multica/core/inbox/queries";
import { EventSummary } from "../ui-workspace-shell/views/team/event-summary";
import { useState } from "react";
import { useQuery, useNavigate, teamApi, text, useTeam, useTeamAction } from "@team-workbench/ui-workspace-shell/client";
import { Action, Failure, Empty } from "../ui-workspace-shell/views/team/ui";
export function TeamInbox({
  onOpen,
}: {
  onOpen: (id: string, commentId?: string) => void;
}) {
  const { workspace } = useTeam();
  const navigate = useNavigate();
  const [archived, setArchived] = useState(false);
  const items = useQuery({
    queryKey: ["team", workspace.id, "inbox", archived],
    queryFn: () =>
      archived ? teamApi.listArchivedInbox() : teamApi.listInbox(),
  });
  const action = useTeamAction(
    async ({ id, mode }: { id: string; mode: string }) =>
      mode === "archive"
        ? teamApi.archiveInbox(id)
        : mode === "restore"
          ? teamApi.unarchiveInbox(id)
          : mode === "unread"
            ? teamApi.markInboxUnread(id)
            : teamApi.markInboxRead(id),
  );
  const grouped = (
    archived
      ? deduplicateArchivedInboxItems(items.data || [])
      : deduplicateInboxItems(items.data || [])
  ).map((group) => ({
    // Keep the event's own snapshot and anchor, never an older comment on a newer event.
    item: items.data?.find((event) => event.id === group.id) || group,
    previous: (items.data || [])
      .filter(
        (event) =>
          group.issue_id &&
          event.issue_id === group.issue_id &&
          event.id !== group.id,
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }));
  return (
    <>
      <div className="team-toolbar">
        <h1>{text("inbox")}</h1>
        <Action onClick={() => setArchived(!archived)}>
          {text(archived ? "current" : "archived")}
        </Action>
      </div>
      <Failure error={items.error || action.error} />
      {grouped.length === 0 && <Empty>{text("noNotifications")}</Empty>}
      <div className="team-list">
        {grouped.map(({ item, previous }) => (
          <article
            className={`team-inbox-row ${item.read ? "" : "team-inbox-unread"}`}
            key={item.id}
          >
            <div>
              <strong>{item.title}</strong>{" "}
              {!item.read && <small>{text("unread")}</small>}
              <p>
                <EventSummary action={item.type} details={item.details || {}} />
              </p>
              {item.body && (
                <p className="team-inbox-excerpt">
                  {item.body.replace(
                    /\[([^\]]+)\]\(mention:\/\/[^)]+\)/g,
                    "$1",
                  )}
                </p>
              )}
              <small>{new Date(item.created_at).toLocaleString()}</small>
              {previous.length > 0 && (
                <details className="team-inbox-history">
                  <summary>
                    {text("earlierNotifications")} · {previous.length}
                  </summary>
                  {previous.map((event) => (
                    <div key={event.id} className="team-inbox-event">
                      <EventSummary
                        action={event.type}
                        details={event.details || {}}
                      />
                      {event.body && (
                        <p className="team-inbox-excerpt">
                          {event.body.replace(
                            /\[([^\]]+)\]\(mention:\/\/[^)]+\)/g,
                            "$1",
                          )}
                        </p>
                      )}
                      <small>
                        {new Date(event.created_at).toLocaleString()}
                      </small>
                      <Action
                        onClick={() => {
                          action.mutate({ id: event.id, mode: "read" });
                          onOpen(event.issue_id!, event.details?.comment_id);
                        }}
                      >
                        {text("open")}
                      </Action>
                    </div>
                  ))}
                </details>
              )}
            </div>
            <div className="team-actions">
              {item.details?.project_id && item.details?.topic_id && (
                <Action
                  onClick={() => {
                    action.mutate({ id: item.id, mode: "read" });
                    navigate(
                      `/team/${workspace.slug}?view=projects&project=${item.details!.project_id}&section=discussion&topic=${item.details!.topic_id}`,
                    );
                  }}
                >
                  {text("project.openTopic")}
                </Action>
              )}
              {item.issue_id && !item.details?.topic_id && (
                <Action
                  onClick={() => {
                    action.mutate({ id: item.id, mode: "read" });
                    onOpen(item.issue_id!, item.details?.comment_id);
                  }}
                >
                  {text("open")}
                </Action>
              )}
              <Action
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    id: item.id,
                    mode: item.read ? "unread" : "read",
                  })
                }
              >
                {text(item.read ? "markUnread" : "markRead")}
              </Action>
              <Action
                disabled={action.isPending}
                onClick={() =>
                  action.mutate({
                    id: item.id,
                    mode: archived ? "restore" : "archive",
                  })
                }
              >
                {text(archived ? "restore" : "archive")}
              </Action>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
