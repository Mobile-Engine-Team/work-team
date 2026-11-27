import { contribute } from '@team-workbench/ui-workspace-shell/contract'
import { TeamSettings } from '../ui-workspace-shell/views/team/team-settings'
export const inject = ['slots']
export function apply(ctx) { contribute(ctx, 'settings', '成员与智能体', 40, TeamSettings) }
