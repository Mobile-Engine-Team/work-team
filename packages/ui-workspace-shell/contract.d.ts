export type Workspace = { id: string; name: string; kind: 'personal' | 'team'; slug: string }
export type User = { id: string; name: string; email: string }
export type Page = 'tasks' | 'inbox' | 'squads' | 'members'
export type NavigationTarget = {
  workspaceId?: Workspace['id']
  page: Page
  squadId?: string
  issueId?: string
  commentId?: string
  fromInbox?: boolean
}
export type PageProps = {
  user: User
  workspace: Workspace
  route: { workspaceId: string | null; page: string | null; issueId: string | null; commentId: string | null; fromInbox: boolean }
  navigate(target: NavigationTarget): void
  refreshWorkspaces(): Promise<Workspace[]>
  onUnauthorized(error: Error): void
  refreshUnread(): void
}

export type Query<T> = { data?: T; loading: boolean; error?: Error | null; reload(): void }
export type Action = {
  clearError(): void
  busy: boolean
  error: Error | null
  uncertain: boolean
  run(action: () => unknown | Promise<unknown>, verify?: () => Promise<boolean>): Promise<boolean>
}

export const PAGE_SLOT: 'workbench.page'
export function contribute(ctx: { slots: {
  inject(name: typeof PAGE_SLOT, callback: () => unknown): unknown
  register(options: { name: typeof PAGE_SLOT; key: Page; label: string; order: number },
    component: (props: PageProps) => unknown): unknown
} }, key: Page, label: string, order: number, component: (props: PageProps) => unknown): void
export function useQuery<T>(call: (signal: AbortSignal) => Promise<T>, dependencies: readonly unknown[]): Query<T>
export function useAction(): Action
export function ErrorNote(props: { error?: Error | null; retry?(): void }): unknown
export function useWorkspaceApi(props: Pick<PageProps, 'workspace' | 'onUnauthorized'>): <T = unknown>(
  operation: string, args?: object, options?: { signal?: AbortSignal; route?: string },
) => Promise<T>
