import { endpoint, id } from './upstream.js'

const root = '/api/inbox/'
export const inbox = {
  'inbox.list': endpoint('GET', root, true),
  'inbox.archived': endpoint('GET', root + 'archived', true),
  ...Object.fromEntries(['read', 'unread', 'archive', 'unarchive'].map(action =>
    ['inbox.' + action, endpoint('POST', args => root + id(args.id) + '/' + action, true)])),
}
