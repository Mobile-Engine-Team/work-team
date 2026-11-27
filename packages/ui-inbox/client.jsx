import { contribute } from '@team-workbench/ui-workspace-shell/contract'
import { TeamInbox } from './view'
export const inject = ['slots']
export function apply(ctx) { contribute(ctx, 'inbox', '收件箱', 20, TeamInbox) }
