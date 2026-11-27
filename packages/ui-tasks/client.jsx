import { useState } from 'react'
import { useSearchParams } from '@team-workbench/ui-workspace-shell/client'
import { contribute } from '@team-workbench/ui-workspace-shell/contract'
import { TaskBoard } from '../ui-workspace-shell/views/team/task-board'
import { NewTask, TaskDetail } from '../ui-workspace-shell/views/team/tasks'

function Tasks({ issueId, onOpen }) {
  const [params]=useSearchParams()
  const [create, setCreate] = useState(params.get("create")==="1" ? {} : null)
  if (issueId) return <TaskDetail key={issueId} id={issueId}/>
  return <>
    <TaskBoard onCreate={(fields={})=>setCreate(fields)}/>
    {create && <NewTask initialFields={create} initialOwner={params.get("owner") || undefined} onClose={() => setCreate(null)} onCreated={id => { setCreate(null); onOpen(id) }}/>}
  </>
}
export const inject = ['slots']
export function apply(ctx) { contribute(ctx, 'tasks', '任务', 10, Tasks) }
