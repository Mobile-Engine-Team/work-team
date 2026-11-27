import { endpoint, id, WorkbenchError } from './upstream.js'
import { FIXTURE_RUNTIME_NAME } from './client-api.js'

const issue = args => '/api/issues/' + id(args.id)
const fields = ['title', 'description', 'status', 'priority', 'assignee_type', 'assignee_id',
  'project_id', 'due_date', 'expected_revision', 'title_base', 'description_base']

function writeIssue(method, path) {
  const prepare = endpoint(method, path, true)
  return input => {
    const data = Object.fromEntries(fields.filter(key => Object.hasOwn(input.args.data || {}, key))
      .map(key => [key, input.args.data[key]]))
    return prepare({ ...input, args: { ...input.args, data: { ...data, suppress_run: true } } })
  }
}

function issueQuery({ filters = {} }) {
  const search = new URLSearchParams()
  for (const key of ['q', 'status', 'assignee_id', 'assignee_ids', 'creator_id', 'project_id',
    'include_no_project', 'include_no_assignee', 'sort', 'direction', 'limit', 'offset']) {
    const value = filters[key]
    if (typeof value === 'string' && value !== '' || typeof value === 'number' || value === true) {
      search.set(key, String(value))
    }
  }
  return '/api/issues/?' + search
}

const listComments = ({ id: value }) => issue({ id: value }) + '/comments'

export const tasks = {
  'issues.list': endpoint('GET', issueQuery, true),
  'issues.statuses': endpoint('GET', '/api/issue-statuses/', true),
  'issues.projects': endpoint('GET', '/api/projects/', true),
  'issues.get': endpoint('GET', args => issue(args) + '/', true),
  'issues.create': writeIssue('POST', '/api/issues/'),
  'issues.update': writeIssue('PUT', args => issue(args) + '/'),
  'issues.attachments': endpoint('GET', args => issue(args) + '/attachments', true),
  'issues.comments': endpoint('GET', listComments, true),
  'issues.comment': async ({ call, workspaceId, args }) => {
    const { content, request_id, parent_id } = args.data || {}
    if (typeof content !== 'string' || !content.trim()) throw new WorkbenchError(400, '请输入评论内容。')
    // Support human mentions. The executor starts only from the explicit run action.
    if (/mention:\/\/(agent|squad)\//i.test(content)) throw new WorkbenchError(400, '此处仅支持提及团队成员。')
    return call('POST', listComments(args), { workspaceId: id(workspaceId),
      body: { content, request_id: id(request_id), parent_id: parent_id ? id(parent_id) : undefined, type: 'comment' } })
  },
  'issues.subscribers': endpoint('GET', args => issue(args) + '/subscribers', true),
  'issues.subscribe': endpoint('POST', args => issue(args) + '/subscribe', true),
  'issues.unsubscribe': endpoint('POST', args => issue(args) + '/unsubscribe', true),
  'issues.runs': endpoint('GET', args => issue(args) + '/task-runs', true),
  'issues.run': async ({ call, user, workspaceId, args }) => {
    const scope = { workspaceId: id(workspaceId) }
    const item = await call('GET', issue(args) + '/', scope)
    if (item.assignee_type !== 'agent') throw new WorkbenchError(409, '请先分派给本产品的本机验证 Agent。')
    const agent = await call('GET', '/api/agents/' + id(item.assignee_id) + '/', scope)
    const runtimes = await call('GET', '/api/runtimes/', scope)
    const runtime = runtimes.find(candidate => candidate.id === agent.runtime_id)
    if (!runtime || runtime.provider !== 'codex' || runtime.status !== 'online' ||
        runtime.owner_id !== user.id || runtime.name !== FIXTURE_RUNTIME_NAME) {
      throw new WorkbenchError(409, '请启用自己登记的本机验证执行端，并重新核对绑定。')
    }
    return call('POST', issue(args) + '/rerun', { ...scope, body: {} })
  },
  'issues.runMessages': endpoint('GET', args => '/api/tasks/' + id(args.id) + '/messages', true),
}
