"""Focused regressions for lost write responses, draft requests and comment deep links."""
import json
import re
from urllib.parse import parse_qs, urlparse
import uuid

from playwright.sync_api import expect

from support import btn, click, close, combo, dialog, field, issue, sql
from tasks import TITLE


def anchors(r):
    a,b=r.a,r.b
    issue(a,TITLE)
    tag=str(uuid.uuid4())[:4]
    labels=['锚点复验一'+tag,'锚点复验二'+tag]
    for label in labels:
        click(a,'提及成员或智能体')
        a.get_by_role('option',name=re.compile(re.escape(r.ub))).click()
        editor=a.locator('[contenteditable=true]')
        editor.press('End')
        a.keyboard.insert_text(' '+label)
        click(a,'发送')
        expect(editor).to_have_text('')
    mapping={}
    query="""select c.id from comment c join issue i on i.id=c.issue_id join workspace w on w.id=i.workspace_id
        where w.slug=:'s' and i.title=:'title' and c.content like '%'||:'label';"""
    for label in labels:
        mapping[label]=str(uuid.UUID(sql(query,s=r.slug,title=TITLE,label=label)))
    assert len(set(mapping.values()))==2
    for label in reversed(labels):
        click(b,'收件箱')
        row=b.locator('.team-inbox-row').filter(has_text=TITLE)
        expect(row).to_be_visible(timeout=12000)
        event=row.locator('.team-inbox-event').filter(has_text=label)
        # A newly fetched latest event remounts this task's <article>. Open its stable history.
        expect(event).to_be_attached(timeout=12000)
        if not event.is_visible():
            row.locator('summary').click()
        expect(event).to_be_visible()
        click(event,'打开任务')
        expect(b.locator('#comment-'+mapping[label])).to_be_focused(timeout=12000)
        assert mapping[label] in b.evaluate('location.hash')
        b.reload()
        expect(b.locator('#comment-'+mapping[label])).to_be_focused(timeout=12000)
    r.ev.business('commentFocus',mapping)
    r.ev.record(b,'IB-02 COMMON-03','同任务先后两次提及，B 从两条历史事件分别打开再刷新',
                '两条不同 comment_id 分别写入路由，键盘焦点与数据库中对应原文的评论 ID 一致。')

def lost_response(r):
    p=r.a
    title='丢回包隔离样本'
    click(p,'任务')
    click(p,'新建任务')
    d=dialog(p)
    field(d,'任务标题').fill(title)
    result=[]
    def lose(route):
        path=parse_qs(urlparse(route.request.url).query).get('path',[''])[0]
        if route.request.method=='POST' and path.rstrip('/')=='/api/issues' and not result:
            actual=route.fetch()
            result.append(actual.status)
            route.abort('failed')
        else:
            route.continue_()
    pattern='**/api/workbench/transport*'
    p.route(pattern,lose)
    try:
        click(d,'创建任务')
        expect(d).to_contain_text('操作未完成')
        expect(field(d,'任务标题')).to_have_value(title)
    finally:
        p.unroute(pattern,lose)
    assert result and 200<=result[0]<300
    close(p)
    p.reload()
    expect(p.locator('.team-task-row').filter(has_text=title)).to_have_count(1)
    assert sql("""select count(*) from issue i join workspace w on w.id=i.workspace_id
        where w.slug=:'s' and i.title=:'t';""",s=r.slug,t=title)=='1'
    r.ev.record(p,'TK-06','仅丢弃实际写入成功的首个创建响应，保留表单后关闭、刷新列表',
                '表单显示未完成并保留标题；恢复读取见一条任务，未自动重送。手动再次提交是独立写入。')

def drafting(r):
    p=r.b
    # An explicitly offline synthetic test agent prevents any model or remote executor from claiming our sample.
    runtime_query="""select rt.id,rt.status,rt.last_seen_at from agent_runtime rt join agent a on a.runtime_id=rt.id
        join workspace w on w.id=a.workspace_id join public."user" u on u.id=a.owner_id
        where w.slug=:'s' and a.name='复验助手' and u.name=:'user' and rt.provider='pi';"""
    target,prior_status,previous_seen=sql(runtime_query,s=r.slug,user=r.ua).split('|')
    uuid.UUID(target)
    assert prior_status=='offline'
    click(p,'任务')
    click(p,'新建任务')
    d=dialog(p)
    field(d,'任务要求').fill('受控起草复核')
    click(d,'智能体起草')
    prompt=field(d,'描述你想创建的任务')
    expect(prompt).to_have_value('受控起草复核')
    combo(d,'起草助手',re.compile('复验助手'))
    click(d,'生成任务草稿')
    expect(d).to_contain_text('操作未完成')
    rid=None
    req_query="""select p.id from project_planning_request p join workspace w on w.id=p.workspace_id
        join public."user" u on u.id=p.created_by where w.slug=:'s' and u.name=:'user'
        and p.input->>'purpose'='task_draft' and p.input->>'instructions'='受控起草复核'
        order by p.created_at desc limit 1;"""
    try:
        sql("update agent_runtime set status='online',last_seen_at=now() where id=:'rid' and status='offline';",rid=target)
        click(d,'生成任务草稿')
        expect(d).to_contain_text('等待执行端生成草稿')
        rid=str(uuid.UUID(sql(req_query,s=r.slug,user=r.ub)))
        sql("update project_planning_request set status='running' where id=:'id' and status='queued';",id=rid)
        expect(d).to_contain_text('正在生成草稿')
        sql("update project_planning_request set status='cancelled' where id=:'id' and status='running';",id=rid)
        expect(d).to_contain_text('生成已取消')
        click(d,'生成任务草稿')
        expect(d).to_contain_text('等待执行端生成草稿')
        next_id=str(uuid.UUID(sql(req_query,s=r.slug,user=r.ub)))
        assert rid!=next_id
        fake={'title':'草稿核对演示','description':'先核对再保存','due_date':'','questions':['谁负责核对？']}
        sql("update project_planning_request set status='succeeded',result=:'result'::jsonb where id=:'id' and status='queued';",
            result=json.dumps(fake,ensure_ascii=False),id=next_id)
        expect(field(d,'任务标题')).to_have_value(fake['title'],timeout=12000)
        expect(d).to_contain_text(fake['questions'][0])
        expect(btn(d,'创建任务')).to_be_disabled()
        d.get_by_role('checkbox').check()
        expect(btn(d,'创建任务')).to_be_enabled()
        combo(d,'负责人',re.compile(r.ub))
        expect(d.get_by_role('checkbox')).not_to_be_checked()
        close(p)
        r.ev.record(p,'TK-07 TK-08','离线提交失败；在本轮专有 runtime 上短时设置在线心跳，以可控数据库回填模拟处理结果',
            '真实起草请求由 B 创建、重试产生另一个请求 ID。界面随排队、运行、取消、成功轮询更新，结果可核对；改负责人撤销确认。')
    finally:
        sql("update agent_runtime set status='offline',last_seen_at=nullif(:'seen','')::timestamptz where id=:'rid';",
            seen=previous_seen,rid=target)

def database(r):
    """Collect the final object graph for this run's workspace only."""
    tables={
        'issues':"""select i.number,i.title,i.status,count(q.id) as executions from issue i
            join workspace w on w.id=i.workspace_id left join agent_task_queue q on q.issue_id=i.id
            where w.slug=:'s' group by i.id order by i.number""",
        'executions':"""select i.number,i.title,q.status,q.started_at is not null as started,
            q.completed_at is not null as ended,q.originator_source,u.name as accountable
            from agent_task_queue q join issue i on i.id=q.issue_id join workspace w on w.id=i.workspace_id
            left join public."user" u on u.id=q.accountable_user_id where w.slug=:'s' order by q.created_at""",
        'inbox':"""select u.name,n.type,n.read,n.archived,count(*) as events from inbox_item n
            join workspace w on w.id=n.workspace_id join public."user" u on u.id=n.recipient_id
            where w.slug=:'s' group by u.name,n.type,n.read,n.archived order by u.name,n.type,n.read,n.archived""",
        'drafts':"""select p.id,p.status,u.name as created_by from project_planning_request p
            join workspace w on w.id=p.workspace_id join public."user" u on u.id=p.created_by
            where w.slug=:'s' and input->>'purpose'='task_draft' order by p.created_at""",
    }
    graph={}
    for name,select in tables.items():
        graph[name]=json.loads(sql("select coalesce(json_agg(t),'[]'::json) from ("+select+") t;",s=r.slug))
    r.ev.business('finalWorkspace',graph)
