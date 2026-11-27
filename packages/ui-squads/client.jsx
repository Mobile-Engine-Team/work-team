import { contribute } from '@team-workbench/ui-workspace-shell/contract'
import { SquadsPage } from '../ui-workspace-shell/views/team/squads'
export const inject = ['slots']
export function apply(ctx) { contribute(ctx, 'squads', '智能体小队', 30, SquadsPage) }
