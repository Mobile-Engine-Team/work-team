import { endpoint, id, workspacePath } from './upstream.js'

function agentData({ data = {} }) {
  const { name, description, instructions, runtime_id, visibility, model, status } = data
  return { name, description, instructions, runtime_id, visibility, model, status }
}

function agentWrite(method, path) {
  const call = endpoint(method, path, true)
  return input => call({ ...input, args: { ...input.args, data: agentData(input.args) } })
}

export const members = {
  'members.list': endpoint('GET', (_, ws) => workspacePath(ws) + '/members'),
  'members.invite': endpoint('POST', (_, ws) => workspacePath(ws) + '/members'),
  'members.invited': endpoint('GET', (_, ws) => workspacePath(ws) + '/invitations'),
  'members.revoke': endpoint('DELETE', (args, ws) => workspacePath(ws) + '/invitations/' + id(args.id)),
  'members.role': endpoint('PATCH', (args, ws) => workspacePath(ws) + '/members/' + id(args.id) + '/'),
  'agents.list': endpoint('GET', '/api/agents/', true),
  'agents.create': agentWrite('POST', '/api/agents/'),
  'agents.update': agentWrite('PUT', args => '/api/agents/' + id(args.id) + '/'),
  'agents.archive': endpoint('POST', args => '/api/agents/' + id(args.id) + '/archive', true),
  'agents.restore': endpoint('POST', args => '/api/agents/' + id(args.id) + '/restore', true),
  'runtimes.list': endpoint('GET', '/api/runtimes/', true),
}
