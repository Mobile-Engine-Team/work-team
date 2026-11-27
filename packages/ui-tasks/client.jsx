import { useState } from 'react'
import { Plus } from 'lucide-react'
import { text } from '@team-workbench/ui-workspace-shell/client'
import { contribute } from '@team-workbench/ui-workspace-shell/contract'
import { Action } from '../ui-workspace-shell/views/team/ui'
import { NewTask, TaskDetail, TaskList } from '../ui-workspace-shell/views/team/tasks'

function Tasks({ issueId, onOpen }) {
  const [create, setCreate] = useState(false)
  if (issueId) return <TaskDetail key={issueId} id={issueId}/>
  return <>
    <div className="team-toolbar"><div className="team-spacer" />
      <Action primary onClick={() => setCreate(true)}><Plus size={16}/>{text('newTask')}</Action>
    </div>
    <TaskList/>
    {create && <NewTask onClose={() => setCreate(false)} onCreated={id => { setCreate(false); onOpen(id) }}/>}
  </>
}
export const inject = ['slots']
export function apply(ctx) { contribute(ctx, 'tasks', '任务', 10, Tasks) }
