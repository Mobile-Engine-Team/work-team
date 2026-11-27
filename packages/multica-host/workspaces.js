import { endpoint, id, workspacePath } from './upstream.js'

export const workspaces = {
  'workspaces.list': endpoint('GET', '/api/workspaces/'),
  'workspaces.create': endpoint('POST', '/api/workspaces/'),
  'workspaces.get': endpoint('GET', (_, ws) => workspacePath(ws) + '/'),
  'invitations.mine': endpoint('GET', '/api/invitations'),
  'invitations.accept': endpoint('POST', ({ id: value }) => '/api/invitations/' + id(value) + '/accept'),
  'invitations.decline': endpoint('POST', ({ id: value }) => '/api/invitations/' + id(value) + '/decline'),
}
