import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useWorkspace, type Project } from './store';
import { newNode, layoutGraph } from './project-blueprint-model';
import type { BlueprintGraph } from './project-blueprint-store';
import { Action, Empty, Field, Modal, Picker, Textarea, text } from './project-reference-ui';

const scopes = [['add','project.scopeAdd'],['selected','project.scopeSelected'],['all','project.entireDraft']] as const;
export function ProjectPlanning({project,graph,selectedNodes,onClose,onApply}: {
  project:Project;graph:BlueprintGraph;selectedNodes:string[];onClose:()=>void;onApply:(graph:BlueprintGraph)=>void;
}) {
  const data = useWorkspace();
  const [agent,setAgent] = useState(''), [instructions,setInstructions] = useState(''), [materials,setMaterials] = useState(''),
    [scope,setScope] = useState(selectedNodes.length ? 'selected' : 'add');
  const [input,setInput] = useState(false), [suggestions,setSuggestions] = useState<BlueprintGraph['nodes']>([]),
    [selected,setSelected] = useState<string[]>([]), [adoption,setAdoption] = useState<BlueprintGraph | null>(null);
  const reset = () => {setInput(false);setSuggestions([]);setSelected([]);setAdoption(null);};
  const scopeLabel = text(scopes.find(([value]) => value === scope)![1]);
  function sample() {
    const details = [instructions,materials].filter(v=>v.trim()).join('\n\n');
    const nodes = scope === 'add' || !graph.nodes.length ? [
      { ...newNode('核对交付标准'), requirements:details || project.description || '确认交付物和验收条件。' },
    ] : graph.nodes.filter(n => scope === 'all' || selectedNodes.includes(n.id)).map(n => ({ ...n,
      requirements:[n.requirements, details || '交付前对照项目目标确认验收条件。'].filter(Boolean).join('\n\n'),
    }));
    setSuggestions(nodes);setSelected([]);setAdoption(null);
  }
  function preview() {
    const picked = suggestions.filter(n => selected.includes(n.id));
    const added = picked.filter(n => !graph.nodes.some(a => a.id === n.id));
    const next = { ...graph, nodes:[...graph.nodes.map(n => picked.find(s => s.id === n.id) || n),...added] };
    setAdoption(added.length ? layoutGraph(next) : next);
  }
  return <Modal wide title={text('project.aiPlanning')} onClose={onClose}>
    <p className="project-notice">本地原型：预览示例建议，不会请求智能体或上传内容。</p>
    <div className="project-ai-layout">
      <section>
        <Field label={text('project.planningAssistant')}><Picker label={text('project.chooseAssistant')} value={agent} onChange={v=>{setAgent(v);reset();}} options={data.agents.map(a=>({value:a.name,label:a.name}))} /></Field>
        <Field label={text('project.planningInstructions')}><Textarea rows={4} placeholder={text('project.adjustmentExample')} value={instructions} onChange={e=>{setInstructions(e.target.value);reset();}} /></Field>
        <Field label={text('project.selectedMaterials')}><Textarea rows={3} placeholder={text('project.materialsHint')} value={materials} onChange={e=>{setMaterials(e.target.value);reset();}} /></Field>
        <Field label={text('project.allowedScope')}><Picker label={text('project.allowedScope')} value={scope} onChange={v=>{setScope(v);reset();}} options={scopes.filter(([value])=>value !== 'selected' || selectedNodes.length).map(([value,label])=>({value,label:text(label)}))} /></Field>
        <Action onClick={()=>setInput(true)}>{text('project.previewInput')}</Action>
        {input && <section className="project-input-preview"><h4>{text('project.goal')}</h4><p>{project.description || '未设置'}</p><h4>{text('project.allowedScope')}</h4><p>{scopeLabel}</p><p>{instructions}</p><p>{materials}</p></section>}
        <Action primary disabled={!agent || !input} onClick={sample}><Sparkles size={15}/>生成示例建议</Action>
      </section>
      <section className="project-ai-results">
        <h3>蓝图调整建议</h3>
        {suggestions.length ? <div className="project-suggestion-list">{suggestions.map(n => <label className="project-suggestion" key={n.id}>
          <input type="checkbox" checked={selected.includes(n.id)} onChange={e=>{setSelected(e.target.checked?[...selected,n.id]:selected.filter(id=>id!==n.id));setAdoption(null);}}/>
          <div><small>{graph.nodes.some(a=>a.id===n.id)?'更新任务':'新增任务'}</small><strong>{n.title}</strong><p>{n.requirements}</p></div>
        </label>)}</div> : <Empty>暂无建议</Empty>}
        {!!suggestions.length && <Action disabled={!selected.length} onClick={preview}>预览采纳结果</Action>}
        {adoption && <div className="project-input-preview"><strong>{adoption.nodes.length} 个任务 · {adoption.edges.length} 条依赖</strong><ul>{adoption.nodes.map(n=><li key={n.id}>{n.title}</li>)}</ul></div>}
        {adoption && <Action primary onClick={()=>onApply(adoption)}>采纳到草案</Action>}
      </section>
    </div>
  </Modal>;
}
