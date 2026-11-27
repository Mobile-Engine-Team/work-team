import { allocateIssueId, getWorkspace, updateWorkspace, type BlueprintNode as StoredNode, type Issue, type Project, type Workspace } from './store';
import { graphEqual, layoutGraph, validEdge } from './project-blueprint-model';

type Fields = { title: string; requirements: string; assignee_id: string; assignee_type: string; due_date: string };
export type BlueprintNode = Fields & { id:string; issue_id:string; position:{ x:number; y:number }; baseline?: Fields & { description:string } };
export type BlueprintGraph = { schema_version:1; nodes:BlueprintNode[]; edges:{ id:string; from:string; to:string; handoff:string }[] };

export const issueSummary = (i:Issue) => ({ id:String(i.id), identifier:`ANDR-${i.id}`, title:i.title, status:i.status, project_id:i.project });
export function taskFields(issue:Partial<Issue>, data:Workspace):Fields {
  const owner = issue.assignee === '无负责人' ? '' : issue.assignee || '';
  return { title:issue.title || '', requirements:issue.description || '', assignee_id:owner,
    assignee_type:!owner ? '' : data.agents.some(a => a.name === owner) ? 'agent' : data.squads.some(s => s.name === owner) ? 'squad' : 'member', due_date:issue.due || '' };
}
export function toGraph(stored:StoredNode[], data:Workspace):BlueprintGraph {
  const byId = new Map(data.issues.map(issue => [issue.id, issue]));
  const ids = new Set(stored.map(n => n.id));
  const graph:BlueprintGraph = { schema_version:1,
    nodes:stored.map(n => {
      const issue = n.issueId ? byId.get(n.issueId) : undefined;
      const fields = taskFields({ ...issue, title:n.title, description:n.description, assignee:n.assignee ?? issue?.assignee, due:n.due ?? issue?.due }, data);
      return { ...fields, assignee_type:n.assigneeType ?? fields.assignee_type, id:n.id, issue_id:n.issueId ? String(n.issueId) : '',
        position:{ x:n.x ?? 0, y:n.y ?? 0 }, baseline:n.baseline };
    }),
    edges:stored.flatMap(n => n.after.filter(id => ids.has(id)).map(from => ({ id:n.edgeIds?.[from] || `${from}→${n.id}`, from, to:n.id, handoff:n.requirements?.[from] || '' }))),
  };
  if (stored.some(n => n.x == null || n.y == null)) {
    const positions = new Map(layoutGraph(graph).nodes.map(n => [n.id,n.position]));
    graph.nodes = graph.nodes.map((n, i) => ({ ...n, position:stored[i].x == null || stored[i].y == null ? positions.get(n.id)! : n.position }));
  }
  return graph;
}
function toStored(graph:BlueprintGraph):StoredNode[] {
  return graph.nodes.map(n => {
    const edges = graph.edges.filter(e => e.to === n.id);
    return { id:n.id, title:n.title, description:n.requirements, issueId:n.issue_id ? Number(n.issue_id) : undefined,
      after:edges.map(e => e.from), x:n.position.x, y:n.position.y, assignee:n.assignee_id || '无负责人', assigneeType:n.assignee_type,
      due:n.due_date, baseline:n.baseline, requirements:Object.fromEntries(edges.map(e => [e.from,e.handoff])), edgeIds:Object.fromEntries(edges.map(e => [e.from,e.id])) };
  });
}
export function saveDraft(project:string, graph:BlueprintGraph, author:string) {
  updateWorkspace(data => {
    const p = data.projects.find(p => p.name === project);
    if (!p) return;
    p.blueprint ??= { versions:[] };
    p.blueprint.draft = toStored(graph);
    p.blueprint.draftAuthor = author;
  });
}
// Open the editable plan without replacing an existing draft or publishing tasks.
export function beginProjectDraft(project:Project, author:string) {
  if (project.blueprint?.draft) return;
  saveDraft(project.name,toGraph(project.blueprint?.versions.at(-1)?.nodes || [], getWorkspace()),author);
}
export function validateDraft(project:Project, graph:BlueprintGraph, data:Workspace):string {
  if (!graph.nodes.length || graph.nodes.some(n => !n.title.trim())) return '请至少添加一个任务，并填写所有任务名称。';
  const byId = new Map(data.issues.map(i => [String(i.id), i]));
  const used = new Set<string>();
  for (const n of graph.nodes) {
    if (!n.issue_id) continue;
    const issue = byId.get(n.issue_id);
    if (!issue || issue.archived || (issue.project && issue.project !== project.name) || used.has(n.issue_id)) return '蓝图有重复或不可用的关联任务，请移除后再发布。';
    used.add(n.issue_id);
    const live = taskFields(issue, data);
    if (n.baseline && contract.some(key => n[key] !== n.baseline![key] && live[key] !== n.baseline![key] && live[key] !== n[key]))
      return `「${n.title}」的任务内容已变更。请先同步任务最新内容，再确认要发布的修改。`;
  }
  const ids = new Set(graph.nodes.map(n => n.id));
  const dependencies: BlueprintGraph = { ...graph, edges:[] };
  for (const e of graph.edges) {
    if (!ids.has(e.from) || !ids.has(e.to) || !validEdge(dependencies,e.from,e.to)) return '前置关系有重复或循环，请调整连线。';
    dependencies.edges.push(e);
  }
  return '';
}
const contract = ['title','requirements','assignee_id','assignee_type','due_date'] as const;
export function publishDraft(name:string, version:number, graph:BlueprintGraph, note:string, author:string) {
  updateWorkspace(data => {
    const project = data.projects.find(p => p.name === name);
    if (!project?.blueprint?.draft || version !== (project.blueprint.versions.at(-1)?.number || 0) + 1 || !graphEqual(toStored(graph), project.blueprint.draft))
      throw new Error('草案已变更，请重新打开发布预览。');
    const error = validateDraft(project, graph, data);
    if (error) throw new Error(error);
    const previous = project.blueprint.versions.at(-1)?.nodes || [];
    const nodes = graph.nodes.map(n => {
      let issue = data.issues.find(i => String(i.id) === n.issue_id);
      if (issue) {
        const prior = previous.find(p => p.id === n.id && p.issueId === issue!.id);
        const live = taskFields(issue,data);
        const baseline = n.baseline ?? (prior ? taskFields({ ...issue, title:prior.title, description:prior.description, assignee:prior.assignee ?? issue.assignee, due:prior.due ?? issue.due }, data) : live);
        if (n.title !== baseline.title) issue.title = n.title.trim();
        if (n.requirements !== baseline.requirements) issue.description = n.requirements;
        if (n.assignee_id !== baseline.assignee_id) issue.assignee = n.assignee_id || '无负责人';
        if (n.due_date !== baseline.due_date) issue.due = n.due_date;
        issue.project = name;
      } else {
        issue = { id:allocateIssueId(data.issues), project:name, title:n.title.trim(), description:n.requirements,
          assignee:n.assignee_id || '无负责人', due:n.due_date, status:'待规划', priority:'无优先级', subscribed:true, pinned:false, read:false };
        data.issues.push(issue);
      }
      const fields = taskFields(issue,data);
      // Keep the reviewed plan snapshot even if unrelated live task fields have moved on.
      return { ...n, title:n.title.trim(), issue_id:String(issue.id), baseline:{ ...fields, description:issue.description } };
    });
    project.blueprint.versions.push({ number:version, nodes:toStored({ ...graph,nodes }), note:note.trim(), author, createdAt:new Date().toISOString() });
    delete project.blueprint.draft;
    delete project.blueprint.draftAuthor;
  });
}
