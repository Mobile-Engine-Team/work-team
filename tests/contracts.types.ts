import type { NavigationTarget, PageProps } from '@team-workbench/ui-workspace-shell/contract'

export function openIssue(props: PageProps, issueId: string, commentId: string) {
  const destination: NavigationTarget = { workspaceId: props.workspace.id, page: 'tasks', issueId, commentId, fromInbox: true }
  props.navigate(destination)
  // @ts-expect-error Each inbox handoff supplies a string comment ID.
  props.navigate({ page: 'tasks', issueId, commentId: 42 })
  // @ts-expect-error An unregistered page is outside the workbench contract.
  props.navigate({ page: 'projects' })
}
