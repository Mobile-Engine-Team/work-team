// Project task rows and the explicit handoff step follow dsh-team-workbench.
import React, { useState } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
import { getWorkspace, updateWorkspace, useWorkspace, type Issue, type Project, type Workspace } from './store';
import { planEqual } from './project-blueprint-model';
import { issueSummary, taskFields, toGraph } from './project-blueprint-store';
import { Action, Empty, Modal, PlanFailure, Status, text } from './project-reference-ui';

export const projectVersion = (project:Project) => project.blueprint?.versions.at(-1);
export function projectDependencies(project:Project, issues:Issue[]) {
  const nodes = projectVersion(project)?.nodes || [];
  const byIssue = new Map(nodes.map(n => [n.issueId,n]));
  const byNode = new Map(nodes.map(n => [n.id,n]));
  const tasks = new Map(issues.filter(i => !i.archived && i.project === project.name).map(i => [i.id,i]));
  const inputs = (issue:Issue) => (byIssue.get(issue.id)?.after || []).flatMap(id => {
    const node = byNode.get(id);
    if (!node) return [];
    const live = node.issueId == null ? undefined : tasks.get(node.issueId);
    return [{nodeId:id,issueId:live?.id,title:live?.title || node.title,delivered:live?.status === '已完成'}];
  });
  return {
    planned:(i:Issue) => byIssue.has(i.id),
    inputs,
    unmet:(i:Issue) => inputs(i).filter(input => !input.delivered).map(input => input.title),
    follows:(i:Issue, predecessorId:number) => {
      const predecessor = byIssue.get(predecessorId);
      return !!predecessor && !!byIssue.get(i.id)?.after.includes(predecessor.id);
    },
  };
}
export const knownProjectTasks = (project:Project, tasks:Issue[]) => {
  const planned = new Set(projectVersion(project)?.nodes.map(n => n.issueId));
  return tasks.filter(i => !i.parentIssueId || planned.has(i.id));
};
const finished = (i:Issue) => i.status === '已完成' || i.status === '已取消';
export const taskInProgress = (i:Issue) => i.status === '进行中' || i.status === '审核中';

export function ProjectTaskRows({issues,onOpen,waiting}: {issues:Issue[];onOpen:(id:number)=>void;waiting:(i:Issue)=>boolean}) {
  return <div className="project-task-list">{issues.length ? issues.map(i => <button type="button" key={i.id} onClick={() => onOpen(i.id)}>
    <div><strong>{i.title}</strong><small>{issueSummary(i).identifier} · {i.assignee || '无负责人'}</small></div>
    <Status value={i.status} />{waiting(i) && !finished(i) && <span className="project-waiting">{text('project.waiting')}</span>}
  </button>) : <Empty>{text('project.noWork')}</Empty>}</div>;
}
export function ProjectTasks({project,tasks,onOrganize,onTask}: {project:Project;tasks:Issue[];onOrganize:()=>void;onTask:(id:number)=>void}) {
  const data = useWorkspace();
  const {unmet} = projectDependencies(project,data.issues);
  const [starting,setStarting] = useState(false);
  const known = knownProjectTasks(project,tasks), internal = tasks.filter(i => i.parentIssueId);
  return <section className="project-known-tasks">
    <div className="project-section-heading"><h2>{text('project.knownTasks')} · {known.length}</h2><div className="project-actions">
      <Action primary onClick={() => setStarting(true)}>{text('project.startTasks')}</Action>
      <Action onClick={onOrganize}>{text('project.organize')}</Action>
    </div></div>
    <ProjectTaskRows issues={known} onOpen={onTask} waiting={i => unmet(i).length > 0} />
    {internal.length > 0 && <details className="project-internal">
      <summary>智能体内部任务 · {internal.length}</summary>
      <ProjectTaskRows issues={internal} onOpen={onTask} waiting={i => unmet(i).length > 0} />
    </details>}
    {starting && <ProjectStart project={project} onClose={() => setStarting(false)} onViewChanges={() => {setStarting(false);onOrganize();}} />}
  </section>;
}
function startItems(project:Project, data:Workspace) {
  const current = projectVersion(project);
  if (!current) return [];
  const {unmet} = projectDependencies(project,data.issues);
  const byId = new Map(data.issues.map(i => [i.id,i]));
  return current.nodes.flatMap(node => {
    const issue = node.issueId && byId.get(node.issueId);
    if (!issue || issue.archived || issue.project !== project.name || finished(issue)) return [];
    const missing = unmet(issue), owner = taskFields(issue,data);
    const kind = owner.assignee_type === 'member' ? 'member' as const : 'agent' as const;
    const recorded = current.starts?.find(s => s.issueId === issue.id && s.assignee === owner.assignee_id);
    const reason = recorded ? '已记录本地推进操作' : missing.length ? `等待前置交付：${missing.join('、')}` : !owner.assignee_id ? '尚未设置负责人' : taskInProgress(issue) ? '任务正在推进' : issue.status === '阻塞' ? '任务已阻塞' : '';
    return [{issue,owner:owner.assignee_id,kind,recorded,reason}];
  });
}
export function ProjectTaskContext({project,issue,onOpen,onPlan}: {project:Project;issue:Issue;onOpen:(id:number)=>void;onPlan:()=>void}) {
  const data = useWorkspace();
  const [handoff,setHandoff] = useState(false);
  const {planned,inputs,follows} = projectDependencies(project,data.issues);
  if (!planned(issue)) return null;
  const predecessors = inputs(issue), waiting = predecessors.filter(i => !i.delivered);
  const downstream = issue.status === '已完成' ? startItems(project,data).filter(i => follows(i.issue,issue.id)) : [];
  return <div className="project-task-context" aria-label="项目交付关系">
    {predecessors.length > 0 && <section className="project-task-handoff">
      <h2>前置交付</h2>
      <ul>{predecessors.map(i => <li key={i.nodeId}>
        {i.issueId != null ? <button type="button" onClick={() => onOpen(i.issueId!)}>{i.title}</button> : <strong>{i.title}</strong>}
        <small>{i.delivered ? '已交付' : i.issueId == null ? '前置任务不在当前项目' : '等待前置交付'}</small>
      </li>)}</ul>
      <p>{waiting.length ? `等待前置交付：${waiting.map(i => i.title).join('、')}` : '前置交付已完成'}</p>
    </section>}
    {issue.status === '已完成' && <section className="project-task-handoff">
      <h2>直接下游任务</h2>
      {downstream.length ? <><ul>{downstream.map(i => <li key={i.issue.id}>
        <button type="button" onClick={() => onOpen(i.issue.id)}>{i.issue.title}</button>
        <small>负责人：{i.owner || '无负责人'} · {i.reason || '可推进'}</small>
      </li>)}</ul><Action onClick={() => setHandoff(true)}>查看下游交接</Action></> : <p>没有待交接的直接下游任务。</p>}
    </section>}
    {handoff && <ProjectStart project={project} predecessorId={issue.id} onClose={() => setHandoff(false)} onViewChanges={() => {setHandoff(false);onPlan();}} />}
  </div>;
}
export function ProjectStart({project,onClose,onViewChanges,predecessorId}: {project:Project;onClose:()=>void;onViewChanges:()=>void;predecessorId?:number}) {
  const data = useWorkspace(), current = projectVersion(project);
  const [selected,setSelected] = useState<number[]>([]), [confirmed,setConfirmed] = useState<number[]>([]), [error,setError] = useState('');
  const unpublished = !!project.blueprint?.draft && !!current && !planEqual(toGraph(project.blueprint.draft,data),toGraph(current.nodes,data));
  const {follows} = projectDependencies(project,data.issues);
  const items = startItems(project,data).filter(i => predecessorId == null || follows(i.issue,predecessorId));
  const ready = items.filter(i => !i.reason), chosen = ready.filter(i => selected.includes(i.issue.id));
  const label = (i:typeof items[number]) => `${text(i.kind === 'member' ? 'project.notifyPerson' : 'project.requestAgent')} · ${i.owner}`;
  function confirm() {
    const latest = getWorkspace().projects.find(p => p.name === project.name);
    if (!current || !chosen.length) return;
    if (!latest || projectVersion(latest)?.number !== current.number) {setError('正式计划已更新，请关闭后重新打开。');return;}
    const expected = chosen.map(i => i.issue.id);
    try {
      updateWorkspace(ws => {
        const p = ws.projects.find(p => p.name === project.name)!;
        const version = projectVersion(p)!;
        const legal = startItems(p,ws).filter(i => !i.reason && expected.includes(i.issue.id));
        if (legal.length !== expected.length || legal.some(i => !chosen.some(c => c.issue.id === i.issue.id && c.owner === i.owner && c.kind === i.kind)))
          throw new Error('任务条件已变化，请重新确认。');
        version.starts ??= [];
        version.starts.push(...legal.map(i => ({issueId:i.issue.id,assignee:i.owner,kind:i.kind,at:new Date().toISOString()})));
      });
      setConfirmed(ids => [...ids,...expected]);setSelected([]);setError('');
    } catch (e) {setError(e instanceof Error ? e.message : String(e));}
  }
  const title = predecessorId == null ? text('project.startTasks') : '查看下游交接';
  if (!current) return <Modal wide title={title} onClose={onClose}>
    <p className="project-plan-version">{text('project.noPublishedPlan')}</p>
    <div className="project-actions"><Action onClick={onClose}>{text('close')}</Action><Action primary onClick={onViewChanges}>前往施工蓝图</Action></div>
  </Modal>;
  return <Modal wide title={title} onClose={onClose}>
    <p className="project-plan-version"><strong>{text('project.startVersion')} V{current.number}</strong></p>
    {unpublished && <div className="project-notice"><strong>{text('project.draftExcluded')}</strong><Action onClick={onViewChanges}>{text('project.viewDraftChanges')}</Action></div>}
    <p>{text('project.startTasksHint')}</p><p className="project-helper">本地原型：确认后只记录选择，不发送通知，也不启动智能体。</p>
    <PlanFailure error={error} />
    <div className="project-start-list">{items.filter(i => !confirmed.includes(i.issue.id)).map(i => <label key={i.issue.id} className={i.reason?'project-start-blocked':'project-start-ready'}>
      <input type="checkbox" aria-label={i.issue.title} disabled={!!i.reason} checked={!i.reason && selected.includes(i.issue.id)} onChange={e => setSelected(e.target.checked ? [...selected,i.issue.id] : selected.filter(id => id !== i.issue.id))} />
      <div><strong>{i.issue.title}</strong><small>{text('project.assignee')}：{i.owner || '无负责人'}</small>
        <p className="project-start-reason">{i.reason ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}<strong>{i.reason || text(i.kind === 'member' ? 'project.canNotify' : 'project.canRequest')}</strong></p>
      </div>
    </label>)}</div>
    {confirmed.length > 0 && <section aria-live="polite"><h3>{text('project.handoffResults')}</h3>{items.filter(i => confirmed.includes(i.issue.id)).map(i => <div className="project-start-result" key={i.issue.id}><strong>{i.issue.title}</strong><span>已记录（未实际派发）</span></div>)}</section>}
    <p role="status">{ready.length ? `${text('project.remainingReady')}：${ready.length}` : items.length ? '当前没有可推进项；请查看上方的任务状态。' : '本版没有待推进任务。'}</p>
    {chosen.length > 0 && <div className="project-handoff-confirm"><strong>{text('project.confirmRecipients')}</strong>{chosen.map(i => <p key={i.issue.id}>{label(i)} · {i.issue.title}</p>)}</div>}
    <div className="project-actions"><Action onClick={onClose}>{text(confirmed.length?'project.finishHandoff':'close')}</Action>{ready.length > 0 && <Action primary disabled={!chosen.length} onClick={confirm}>{text('project.confirmStart')} ({chosen.length})</Action>}</div>
  </Modal>;
}
