import { endpoint, id } from './upstream.js'
const squad = args => '/api/squads/' + id(args.id)

export const squads = {
  'squads.list': endpoint('GET', '/api/squads/', true),
  'squads.get': endpoint('GET', args => squad(args) + '/', true),
  'squads.create': endpoint('POST', '/api/squads/', true),
  'squads.update': endpoint('PUT', args => squad(args) + '/', true),
  'squads.archive': endpoint('DELETE', args => squad(args) + '/', true),
  'squads.members': endpoint('GET', args => squad(args) + '/members', true),
  'squads.addMember': endpoint('POST', args => squad(args) + '/members', true),
  'squads.removeMember': endpoint('DELETE', args => squad(args) + '/members', true),
  'squads.memberRole': endpoint('PATCH', args => squad(args) + '/members/role', true),
}
