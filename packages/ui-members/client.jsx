import { contribute } from '@team-workbench/ui-workspace-shell/contract'
import { TeamSettings } from '../ui-workspace-shell/views/team/team-settings'
import {AgentChat} from "../ui-workspace-shell/views/team/agent-chat"
import { SpacePage } from '../ui-workspace-shell/views/team/space'
export const inject = ['slots']
export function apply(ctx) {
  contribute(ctx, "agent-chat","智能体对话",44,AgentChat)
  contribute(ctx, 'settings', '协作空间', 40, SpacePage)
  contribute(ctx, "runtime", "运行时", 43, () => <TeamSettings section="runtime" />)
  contribute(ctx, 'agents', '智能体', 41, () => <TeamSettings section="agents" />)
}
