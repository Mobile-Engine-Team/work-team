import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Folder, Search, CalendarDays, FolderKanban, GitBranch, Plus, Settings2, Trash2, Target } from "../icons";
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
  Modal,
  Picker,
  Status,
} from "./ui";
import { useTeamPeople } from "./tasks";
import { allProjectIssues } from "./project-issues";
import { BlueprintEditor } from "./blueprint-editor";
import { ProjectStart } from "./project-planning";
import "./project-desk.css";
import { TeamMarkdown } from "./markdown";
import "./projects.css";

export function ProjectsPage() {
  const [params, setParams] = useSearchParams(),
    id = params.get("project");
  const projects = useTeamQuery(["projects"], () => teamApi.listProjects());
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const rows = (projects.data?.projects || []).filter(p =>
    (!statusFilter || p.status === statusFilter) &&
    (p.title + " " + (p.description || "")).toLocaleLowerCase().includes(keyword.trim().toLocaleLowerCase()));
  const [create, setCreate] = useState(params.get("create")==="1");
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
    <section className="pd-shell">
      <header className="pd-page-heading"><div><h1>全部项目</h1><p>在当前空间统一查看项目目标、蓝图与任务进度。</p></div>
        <Action primary onClick={() => setCreate(true)}><Plus size={17}/>新建项目</Action>
      </header>
      <Failure error={projects.error}/>
      {!!projects.data?.projects.length && <div className="pd-catalog-tools">
        <label className="pd-search"><Search size={15}/><input aria-label="搜索项目" placeholder="搜索项目…" value={keyword} onChange={e=>setKeyword(e.target.value)}/></label>
        <Picker label="筛选项目状态" value={statusFilter} options={[{value:"",label:"全部状态"},...projectStatuses.map(value=>({value,label:text("project.status."+value)}))]} onChange={setStatusFilter}/>
        <span>共 {rows.length} 个项目</span></div>}
      {rows.length ? <div className="pd-project-grid">{rows.map((project,index)=><ProjectCard key={project.id} project={project} index={index} onOpen={()=>open(project.id)}/>)}</div>
        : projects.isPending ? <Empty>{text("loading")}</Empty> : !projects.error && <div className="pd-empty"><Folder size={28}/>
          <h2>{projects.data?.projects.length ? "没有匹配的项目" : "还没有项目"}</h2>
          <p>{projects.data?.projects.length ? "试试其他关键词或清除筛选条件。" : "先写下目标和交付标准，再用蓝图安排后续任务。"}</p>
          {projects.data?.projects.length ? <Action onClick={()=>{setKeyword("");setStatusFilter("")}}>清除筛选</Action> : <Action primary onClick={()=>setCreate(true)}><Plus size={16}/>新建项目</Action>}
        </div>}
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
const projectStatuses: ProjectStatus[] = ["planned","in_progress","paused","completed","cancelled"];
const tones = {planned:"plan",in_progress:"active",paused:"paused",completed:"done",cancelled:"off"};
function ProjectCard({project:p,index,onOpen}: {project:Project; index:number; onOpen:()=>void}) {
  const issues = useTeamQuery(["issues","project",p.id],()=>allProjectIssues(p.id));
  const versions = useTeamQuery(["blueprint",p.id,"versions"],()=>teamApi.listBlueprintVersions(p.id));
  const people = useTeamPeople();
  const active = issues.data?.filter(i=>i.status !== "cancelled");
  const done = active?.filter(i=>i.status === "done").length || 0;
  const progress = active?.length ? Math.round(100*done/active.length) : 0;
  const version = versions.data?.versions[0];
  return <button className="pd-project-card" onClick={onOpen}><header>
    <span className="pd-project-icon" data-color={index%3}><Folder size={19}/></span>
    <span className="pd-status" data-tone={tones[p.status]}><i/>{text("project.status."+p.status)}</span></header>
    <h2>{p.title}<ChevronRight size={16}/></h2><p>{p.description || "暂无目标与交付标准"}</p>
    <div className="pd-progress" role="progressbar" aria-label="任务完成进度" aria-valuenow={progress}><i style={{width:progress+"%"}}/></div>
    <div className="pd-card-meta"><span>{active ? done+"/"+active.length+" 项任务已完成" : "—"}</span><span>{version ? "蓝图 V"+version.number : versions.data ? "尚无正式计划" : "—"}</span></div>
    <footer><span>{people.name(p.lead_id)}</span><span><CalendarDays size={13}/>{p.due_date || "日期待定"}</span></footer></button>;
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
  const people = useTeamPeople(),
    [settings, setSettings] = useState(false),
    [starting, setStarting] = useState(false);
  const save = useTeamAction(async (data: UpdateProjectRequest) => {
    await teamApi.updateProject(id, data);
    setSettings(false);
  });
  const remove = useTeamAction(async () => { await teamApi.deleteProject(id); onBack(); });
  const draft = useTeamQuery(["blueprint",id,"draft"],()=>teamApi.getBlueprintDraft(id));
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
      `/team/${workspace.slug}/issue/${issue}?project=${id}&section=${tab}`, {state:{taskIds:issues.map(row=>row.id)}},
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
    <section className="project-detail v3-project-detail">
      <header className="pd-project-header"><button className="pd-back" onClick={onBack}><ArrowLeft size={15}/>全部项目</button>
        <div className="pd-page-heading"><div><span className="pd-status" data-tone={tones[p.status]}><i/>{text("project.status."+p.status)}</span><h1>{p.title}</h1>
        <div className="pd-heading-meta"><span>{people.name(p.lead_id)}</span><span><CalendarDays size={14}/>{p.start_date?(p.start_date+(p.due_date?" 至 "+p.due_date+" 截止":" 开始")):p.due_date?p.due_date+" 截止":"日期待定"}</span><span>{current?"V"+current.number:"尚无正式计划"}</span></div></div>
        {canPublish&&<Action onClick={()=>setSettings(true)}><Settings2 size={16}/>项目设置</Action>}</div>
        <nav className="pd-project-tabs" aria-label="项目页面">{["overview","blueprint","tasks"].map(key=><button key={key} aria-current={tab===key?"page":undefined} onClick={()=>setTab(key)}>{text("project."+key)}{key==="tasks"&&<small>{top.length}</small>}</button>)}</nav>
      </header><div className="pd-project-body">
      <Failure error={issuesQuery.error || versions.error} />
      {tab === "blueprint" ? (
        <BlueprintEditor
          project={p}
          issues={issues}
          canPublish={canPublish}
          onOpen={open}
        />

      ) : tab === "tasks" ? (
        <section className="project-known-tasks">
          <div className="project-section-heading">
            <h2>
              {text("project.knownTasks")} · {top.length}
            </h2>
            <div className="project-actions">
              <Action primary onClick={() => setStarting(true)}>
                {text("project.startTasks")}
              </Action>
              <Action onClick={() => setTab("blueprint")}>
                {text("project.organize")}
              </Action>
            </div>
          </div>
          <ProjectTaskRows issues={top} onOpen={open} waiting={waiting} />
          {issues.some((i) => i.parent_issue_id) && (
            <details className="project-internal">
              <summary>
                智能体内部任务 ·{" "}
                {issues.filter((i) => i.parent_issue_id).length}
              </summary>
              <ProjectTaskRows
                issues={issues.filter((i) => i.parent_issue_id)}
                onOpen={open}
                waiting={waiting}
              />
            </details>
          )}
        </section>
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
                {draft.data?.draft?.status === "active" ? "继续编辑蓝图" : "绘制蓝图"}
              </Action>

            </div>
          )}
          {current && <div className="project-section-heading"><h2>当前计划 V{current.number}</h2><div className="project-actions"><Action onClick={()=>setTab("blueprint")}>查看施工蓝图</Action><Action primary onClick={()=>setStarting(true)}>查看可推进任务</Action></div></div>}
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
          onDelete={people.role === "admin" || people.role === "owner" ? ()=>remove.mutate() : undefined}
          busy={save.isPending || remove.isPending}
          error={save.error || remove.error}
        />
      )}
      </div>
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
  onDelete,
  onClose,
  onSave,
  busy,
  error,
}: {
  project?: Project;
  onDelete?:()=>void;
  onClose: () => void;
  onSave: (data: UpdateProjectRequest) => void;
  busy: boolean;
  error: unknown;
}) {
  const people = useTeamPeople();
  const [title, setTitle] = useState(project?.title || ""),
    [goal, setGoal] = useState(project?.description || ""),
    [start,setStart] = useState(project?.start_date || ""),
    [priority,setPriority] = useState<Project["priority"]>(project?.priority || "none"),
    [confirmDelete,setConfirmDelete] = useState(false),
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
  const [validation,setValidation]=useState("");
  function submit(){
    if(busy) return;
    if(!title.trim()){setValidation("请输入项目名称");return}
    if(start && date && start>date){setValidation("截止日期不能早于开始日期");return}
    setValidation("");
    onSave({title:title.trim(),description:goal.trim(),...(project?{
      start_date:start||null,due_date:date||null,status,priority,
      ...(lead===(project.lead_id||"")?{}:{lead_type:lead?"member":null,lead_id:lead||null}),
    }:{})});
  }
  if(confirmDelete)return <Modal title="删除项目" onClose={()=>setConfirmDelete(false)}>
    <p>删除「{project?.title}」及其蓝图？关联任务和会话将保留。</p>
    <Failure error={error}/><div className="project-actions"><Action onClick={()=>setConfirmDelete(false)}>取消</Action><Action disabled={busy} onClick={onDelete}>删除</Action></div>
  </Modal>;
  const owners=(people.members.data||[]).map(m=>({value:m.user_id,label:m.name||m.email}));
  if(project?.lead_id&&!owners.some(m=>m.value===project.lead_id))
    owners.push({value:project.lead_id,label:people.name(project.lead_id)});
  return <Modal title={project?"项目设置":"新建项目"} onClose={onClose} className="mw-project-form-dialog">
    <div className="mw-project-form-body"><form id="mw-project-form" className="pd-form" onSubmit={event=>{event.preventDefault();submit()}}>
      <label>项目名称<input aria-label="项目名称" autoFocus maxLength={100} value={title} onChange={e=>{setTitle(e.target.value);setValidation("")}} placeholder="例如：品牌内容计划"/></label>
      <label>目标与交付标准 <small>可选</small><textarea aria-label="目标与交付标准" rows={4} value={goal} onChange={e=>setGoal(e.target.value)} placeholder="计划完成什么？怎样算交付完成？"/></label>
      {project?<div className="pd-form-grid">
        <Field label="项目状态"><Picker label="项目状态" value={status}
          options={statusOptions.map(value=>({value,label:text("project.status."+value)}))}
          onChange={value=>{const found=statusOptions.find(v=>v===value);if(found)setStatus(found)}}/></Field>
        <Field label="项目负责人"><Picker label="项目负责人" value={lead} options={[{value:"",label:"无负责人"},...owners]} onChange={setLead}/></Field>
        <Field label="优先级"><Picker label="项目优先级" value={priority} options={["none","low","medium","high","urgent"].map(value=>({value,label:text("priority."+value)}))} onChange={v=>setPriority(v as Project["priority"])}/></Field>
        <label>开始日期<input type="date" value={start} onChange={e=>{setStart(e.target.value);setValidation("")}}/></label>
        <label>截止日期<input type="date" value={date} onChange={e=>{setDate(e.target.value);setValidation("")}}/></label>
      </div>:<p>创建后进入项目总览。负责人、日期等信息可在项目设置中补充。</p>}
      {validation&&<p role="alert" className="pd-error">{validation}</p>}
      <Failure error={error}/>
    </form></div>
    <footer>{onDelete&&<button className="pd-danger" disabled={busy} onClick={()=>setConfirmDelete(true)}><Trash2 size={15}/>删除项目</button>}
      <Action onClick={onClose}>取消</Action><Action primary disabled={busy} onClick={submit}>{project?"保存设置":"创建项目"}</Action>
    </footer>
  </Modal>;
}
