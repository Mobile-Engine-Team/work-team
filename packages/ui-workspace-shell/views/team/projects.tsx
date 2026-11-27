import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FolderKanban,
  GitBranch,
  MessageSquare,
  Plus,
  Settings2,
  Target,
} from "lucide-react";
import type {
  Issue,
  Project,
  ProjectStatus,
  UpdateProjectRequest,
} from "@multica/core/types";
import { text, teamApi, useTeam, useTeamAction, useTeamQuery } from "./client";
import {
  Action,
  Empty,
  Failure,
  Field,
  Input,
  Modal,
  Picker,
  Status,
  Textarea,
} from "./ui";
import { useTeamPeople } from "./tasks";
import { BlueprintEditor } from "./blueprint-editor";
import { ProjectStart } from "./project-planning";
import { ProjectDiscussion } from "./project-discussion";
import { TeamMarkdown } from "./markdown";
import "./projects.css";

export async function allProjectIssues(project_id: string) {
  const issues: Issue[] = [];
  let total = 0;
  do {
    const page = await teamApi.listIssues({
      project_id,
      limit: 100,
      offset: issues.length,
    });
    issues.push(...page.issues);
    total = page.total;
    if (!page.issues.length) break;
  } while (issues.length < total);
  return issues;
}
export function ProjectsPage() {
  const [params, setParams] = useSearchParams(),
    id = params.get("project");
  const projects = useTeamQuery(["projects"], () => teamApi.listProjects());
  const [create, setCreate] = useState(false);
  const { user } = useTeam();
  const open = (project: string) => setParams({ view: "projects", project });
  const action = useTeamAction(async (data: UpdateProjectRequest) => {
    const p = await teamApi.createProject({
      title: data.title || "",
      description: data.description || "",
      lead_type: "member",
      lead_id: user.id,
    });
    setCreate(false);
    open(p.id);
  });
  if (id)
    return (
      <ProjectDetail
        key={id}
        id={id}
        onBack={() => setParams({ view: "projects" })}
      />
    );
  return (
    <section className="project-home">
      <div className="project-page-heading">
        <div>
          <span className="project-eyebrow">
            {text("project.workspacePlans")}
          </span>
          <h1>{text("project.projects")}</h1>
          <p>{text("project.listHint")}</p>
        </div>
        <Action primary onClick={() => setCreate(true)}>
          <Plus size={17} />
          {text("project.create")}
        </Action>
      </div>
      <Failure error={projects.error} />
      {!projects.isPending && !projects.data?.projects.length ? (
        <div className="project-empty">
          <FolderKanban size={46} />
          <h2>{text("project.emptyTitle")}</h2>
          <p>{text("project.emptyHint")}</p>
          <Action primary onClick={() => setCreate(true)}>
            {text("project.create")}
          </Action>
        </div>
      ) : (
        <div className="project-grid">
          {projects.data?.projects.map((p) => (
            <ProjectCard key={p.id} project={p} onOpen={() => open(p.id)} />
          ))}
        </div>
      )}
      {create && (
        <ProjectForm
          onClose={() => setCreate(false)}
          onSave={(data) => action.mutate(data)}
          busy={action.isPending}
          error={action.error}
        />
      )}
    </section>
  );
}
function ProjectCard({
  project: p,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  const issues = useTeamQuery(["issues", "project", p.id], () =>
    allProjectIssues(p.id),
  );
  const topics = useTeamQuery(["topics", p.id], () =>
    teamApi.listProjectTopics(p.id),
  );
  const people = useTeamPeople();
  const top = (issues.data || []).filter((i) => !i.parent_issue_id);
  return (
    <button className="project-card" onClick={onOpen}>
      <div className="project-card-top">
        <span className="project-card-icon">
          <FolderKanban size={22} />
        </span>
        <span className={`project-state project-state-${p.status}`}>
          {text(`project.status.${p.status}`)}
        </span>
      </div>
      <h2>{p.title}</h2>
      <p>{p.description || text("project.goalPending")}</p>
      <div className="project-card-facts">
        <span>
          {text("project.knownTasks")} {top.length} · {text("project.done")}{" "}
          {top.filter((i) => i.status === "done").length}
        </span>
        <span>
          {text("project.openTopics")}{" "}
          {topics.data?.topics.filter((t) => t.status === "open").length || 0}
        </span>
      </div>
      <footer>
        <span>{people.name(p.lead_id)}</span>
        <ArrowRight size={18} />
      </footer>
    </button>
  );
}
function ProjectDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { workspace, user } = useTeam(),
    navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("section") || "overview";
  const setTab = (section: string) =>
    setParams(prev => { const next = new URLSearchParams(prev); next.set("section",section); return next; });
  const query = useTeamQuery(["project", id], () => teamApi.getProject(id)),
    issuesQuery = useTeamQuery(["issues", "project", id], () =>
      allProjectIssues(id),
    );
  const versions = useTeamQuery(["blueprint", id, "versions"], () =>
    teamApi.listBlueprintVersions(id),
  );
  const topics = useTeamQuery(["topics", id], () =>
    teamApi.listProjectTopics(id),
  );
  const people = useTeamPeople(),
    [settings, setSettings] = useState(false),
    [starting, setStarting] = useState(false);
  const save = useTeamAction(async (data: UpdateProjectRequest) => {
    await teamApi.updateProject(id, data);
    setSettings(false);
  });
  const p = query.data,
    issues = issuesQuery.data || [],
    current = versions.data?.versions[0];
  const canPublish =
    !!p &&
    (people.role === "owner" ||
      people.role === "admin" ||
      (p.lead_type === "member" && p.lead_id === user.id));
  const open = (issue: string) =>
    navigate(
      `/team/${workspace.slug}/issue/${issue}?project=${id}&section=${tab}`,
    );
  if (!p)
    return (
      <>
        <Failure error={query.error} />
        <Empty>{text("loading")}</Empty>
      </>
    );
  const nodes = current?.graph.nodes || [],
    edges = current?.graph.edges || [];
  const waiting = (i: Issue) => {
    const n = nodes.find((n) => n.issue_id === i.id);
    return (
      !!n &&
      edges.some(
        (e) =>
          e.to === n.id &&
          issues.find(
            (i) => i.id === nodes.find((n) => n.id === e.from)?.issue_id,
          )?.status !== "done",
      )
    );
  };
  const top = issues.filter(
    (i) => !i.parent_issue_id || nodes.some((n) => n.issue_id === i.id),
  );
  const groups = [
    {
      key: "active",
      items: top.filter(
        (i) => i.status === "in_progress" || i.status === "in_review",
      ),
    },
    {
      key: "pending",
      items: top.filter(
        (i) => (i.status === "backlog" || i.status === "todo") && !waiting(i),
      ),
    },
    {
      key: "waiting",
      items: top.filter(
        (i) => i.status !== "done" && i.status !== "cancelled" && waiting(i),
      ),
    },
    { key: "deliveries", items: top.filter((i) => i.status === "done") },
    {
      key: "unplanned",
      items: top.filter((i) => !nodes.some((n) => n.issue_id === i.id)),
    },
  ];
  return (
    <section className="project-detail">
      <button className="project-back" onClick={onBack}>
        <ArrowLeft size={15} />
        {text("project.allProjects")}
      </button>
      <div className="project-page-heading">
        <div>
          <span className={`project-state project-state-${p.status}`}>
            {text(`project.status.${p.status}`)}
          </span>
          <h1>{p.title}</h1>
          <div className="project-meta">
            <span>{people.name(p.lead_id)}</span>
            <span>
              <CalendarDays size={14} />
              {p.due_date || text("project.datePending")}
            </span>
            <span>
              {current ? `V${current.number}` : text("project.noPlan")}
            </span>
          </div>
        </div>
        {canPublish && (
          <Action onClick={() => setSettings(true)}>
            <Settings2 size={16} />
            {text("project.settings")}
          </Action>
        )}
      </div>
      <nav className="project-tabs">
        {["overview", "blueprint", "tasks", "discussion"].map((key) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {text(`project.${key}`)}
            {key === "tasks" && <span>{top.length}</span>}
          </button>
        ))}
      </nav>
      <Failure error={issuesQuery.error || versions.error || topics.error} />
      {tab === "blueprint" ? (
        <BlueprintEditor
          project={p}
          issues={issues}
          canPublish={canPublish}
          onOpen={open}
        />
      ) : tab === "discussion" ? (
        <ProjectDiscussion project={p} issues={issues} onOpen={open} />
      ) : tab === "tasks" ? (
        <>
          <div className="project-section-heading">
            <h2>
              {text("project.knownTasks")} · {top.length}
            </h2>
            <div className="project-actions">
              {current && (
                <Action primary onClick={() => setStarting(true)}>
                  {text("project.startTasks")}
                </Action>
              )}
              <Action onClick={() => setTab("blueprint")}>
                {text("project.organize")}
              </Action>
            </div>
          </div>
          <ProjectTaskRows issues={top} onOpen={open} waiting={waiting} />
          {issues.some((i) => i.parent_issue_id) && (
            <details className="project-internal">
              <summary>
                {text("project.internalTasks")} ·{" "}
                {issues.filter((i) => i.parent_issue_id).length}
              </summary>
              <ProjectTaskRows
                issues={issues.filter((i) => i.parent_issue_id)}
                onOpen={open}
                waiting={waiting}
              />
            </details>
          )}
        </>
      ) : (
        <>
          <div className="project-overview-top">
            <article className="project-goal">
              <Target size={22} />
              <div>
                <h3>{text("project.goal")}</h3>
                <TeamMarkdown
                  content={p.description || text("project.goalPending")}
                />
              </div>
            </article>
            <div className="project-counts">
              {[
                { label: "knownTasks", count: top.length },
                {
                  label: "done",
                  count: top.filter((i) => i.status === "done").length,
                },
                {
                  label: "active",
                  count: top.filter(
                    (i) =>
                      i.status === "in_progress" || i.status === "in_review",
                  ).length,
                },
                {
                  label: "cancelled",
                  count: top.filter((i) => i.status === "cancelled").length,
                },
              ].map((c) => (
                <div key={c.label}>
                  <strong>{c.count}</strong>
                  <span>{text(`project.${c.label}`)}</span>
                </div>
              ))}
            </div>
          </div>
          {!current && (
            <div className="project-get-started">
              <div>
                <GitBranch size={26} />
                <h3>{text("project.startSmall")}</h3>
                <p>{text("project.startHint")}</p>
              </div>
              <Action primary onClick={() => setTab("blueprint")}>
                {text("project.draw")}
              </Action>
              <Action onClick={() => setTab("discussion")}>
                <MessageSquare size={16} />
                {text("project.startDiscussion")}
              </Action>
            </div>
          )}
          <div className="project-overview-grid">
            {groups.map((group) => (
              <article key={group.key}>
                <div className="project-section-heading">
                  <h3>{text(`project.${group.key}`)}</h3>
                  <span>{group.items.length}</span>
                </div>
                <ProjectTaskRows
                  issues={group.items}
                  onOpen={open}
                  waiting={waiting}
                />
              </article>
            ))}
            <article>
              <div className="project-section-heading">
                <h3>{text("project.openTopics")}</h3>
                <Action onClick={() => setTab("discussion")}>
                  {text("project.viewDiscussions")}
                </Action>
              </div>
              <p className="project-open-topics-hint">
                {text("project.openTopicsHint")}
              </p>
              <Failure error={topics.error} />
              {topics.isPending && <Empty>{text("loading")}</Empty>}
              {topics.data && !topics.data.topics.some((t) => t.status === "open") && (
                <Empty>{text("project.noOpenTopics")}</Empty>
              )}
              {topics.data?.topics
                .filter((t) => t.status === "open")
                .map((t) => (
                  <button
                    className="project-topic-link"
                    key={t.id}
                    onClick={() =>
                      setParams({
                        view: "projects",
                        project: id,
                        section: "discussion",
                        topic: t.id,
                      })
                    }
                  >
                    {t.title}
                    <ArrowRight size={15} />
                  </button>
                ))}
            </article>
          </div>
        </>
      )}
      {starting && (
        <ProjectStart project={p} onClose={() => setStarting(false)} />
      )}
      {settings && (
        <ProjectForm
          project={p}
          onClose={() => setSettings(false)}
          onSave={(data) => save.mutate(data)}
          busy={save.isPending}
          error={save.error}
        />
      )}
    </section>
  );
}
function ProjectTaskRows({
  issues,
  onOpen,
  waiting,
}: {
  issues: Issue[];
  onOpen: (id: string) => void;
  waiting: (i: Issue) => boolean;
}) {
  const people = useTeamPeople();
  return (
    <div className="project-task-list">
      {issues.length ? (
        issues.map((i) => (
          <button key={i.id} onClick={() => onOpen(i.id)}>
            <div>
              <strong>{i.title}</strong>
              <small>
                {i.identifier} · {people.name(i.assignee_id)}
              </small>
            </div>
            <Status value={i.status} />
            {waiting(i) && i.status !== "done" && i.status !== "cancelled" && (
              <span className="project-waiting">{text("project.waiting")}</span>
            )}
          </button>
        ))
      ) : (
        <Empty>{text("project.noWork")}</Empty>
      )}
    </div>
  );
}
function ProjectForm({
  project,
  onClose,
  onSave,
  busy,
  error,
}: {
  project?: Project;
  onClose: () => void;
  onSave: (data: UpdateProjectRequest) => void;
  busy: boolean;
  error: unknown;
}) {
  const people = useTeamPeople();
  const [title, setTitle] = useState(project?.title || ""),
    [goal, setGoal] = useState(project?.description || ""),
    [date, setDate] = useState(project?.due_date || ""),
    [lead, setLead] = useState(project?.lead_id || ""),
    [status, setStatus] = useState<ProjectStatus>(project?.status || "planned");
  const statusOptions: ProjectStatus[] = [
    "planned",
    "in_progress",
    "paused",
    "completed",
    "cancelled",
  ];
  return (
    <Modal
      title={text(project ? "project.settings" : "project.create")}
      onClose={onClose}
    >
      <Field label={text("project.name")}>
        <Input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label={text("project.goal")}>
        <Textarea
          rows={5}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={text("project.goalPlaceholder")}
        />
      </Field>
      {project && (
        <>
          <Field label={text("project.lead")}>
            <Picker
              label={text("project.lead")}
              value={lead}
              options={(people.members.data || []).map((m) => ({
                value: m.user_id,
                label: m.name || m.email,
              }))}
              onChange={setLead}
            />
          </Field>
          <Field label={text("project.statusLabel")}>
            <Picker
              label={text("project.statusLabel")}
              value={status}
              options={statusOptions.map((value) => ({
                value,
                label: text(`project.status.${value}`),
              }))}
              onChange={(value) => {
                const found = statusOptions.find((s) => s === value);
                if (found) setStatus(found);
              }}
            />
          </Field>
          <Field label={text("project.dueDate")}>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </>
      )}
      <Failure error={error} />
      <Action
        primary
        disabled={!title.trim() || busy}
        onClick={() =>
          onSave({
            title,
            description: goal,
            ...(project
              ? {
                  due_date: date || null,
                  lead_type: "member",
                  lead_id: lead,
                  status,
                }
              : {}),
          })
        }
      >
        {text(project ? "project.save" : "project.create")}
      </Action>
    </Modal>
  );
}
