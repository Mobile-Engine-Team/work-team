"""Reproduce delayed writes, role changes, read recovery and paging in a synthetic workspace."""
import re
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect

from support import btn, click, close, combo, dialog, field, space, sql

def pending(r):
    p=r.a
    for dismiss in (True,False):
        new_slug=r.slug+('-delay' if dismiss else '-pages')
        label='慢写入复验' if dismiss else '分页复验'
        click(p,'新建工作区')
        d=dialog(p)
        expect(field(d,'名称')).to_be_focused()
        field(d,'名称').fill(label)
        field(d,'工作区地址').fill(new_slug)
        expect(field(d,'名称')).to_have_value(label)
        expect(field(d,'工作区地址')).to_have_value(new_slug)
        held=[]
        def hold(route):
            path=parse_qs(urlparse(route.request.url).query).get('path',[''])[0]
            if route.request.method=='POST' and path.rstrip('/')=='/api/workspaces':
                held.append(route)
            else:
                route.continue_()
        pattern='**/api/workbench/transport*'
        p.route(pattern,hold)
        try:
            box=btn(d,'创建').bounding_box()
            p.mouse.click(box['x']+10,box['y']+10,click_count=1 if dismiss else 2,delay=20)
            expect(btn(d,'创建')).to_be_disabled()
            if dismiss:
                close(p)
            assert len(held)==1
        finally:
            for route in held:
                route.continue_()
            p.unroute(pattern,hold)
        expect(p.get_by_role('combobox',name='工作区')).to_contain_text(label)
        assert sql("select count(*) from workspace where slug=:'s';",s=new_slug)=='1'
        r.ev.record(p,'WS-11' if dismiss else 'WS-12',
            '延迟本次创建请求期间'+('按 Esc' if dismiss else '在相同位置双击'),
            '创建按钮 pending 禁用，仅收到一条创建请求，最终导航到对应团队且仅写入一行。')
    click(p,'任务')
    click(p,'新建任务')
    field(dialog(p),'任务标题').fill('分页种子')
    click(dialog(p),'创建任务')
    expect(btn(p,'返回任务列表')).to_be_visible()
    # The unique seed is created through the product. Use the same 101-row dataset as frozen replay.
    sql("""insert into issue(workspace_id,title,status,priority,creator_type,creator_id,number,created_at)
        select i.workspace_id,'分页样本-'||lpad(n::text,3,'0'),i.status,i.priority,i.creator_type,
        i.creator_id,i.number+n,now()+n*interval '1 second'
        from issue i join workspace w on i.workspace_id=w.id cross join generate_series(1,101) n
        where w.slug=:'s' and i.title='分页种子';""",s=new_slug)
    click(p,'返回任务列表')
    p.reload()
    counts=[]
    for count in (50,50,2):
        expect(p.locator('.team-task-row')).to_have_count(count)
        counts.append(count)
        if count==50:
            click(p,'下一页')
    expect(btn(p,'下一页')).to_be_disabled()
    field(p,'搜索任务').fill('分页种子')
    expect(p.locator('.team-task-row')).to_have_count(1)
    r.ev.business('pages',counts)
    r.ev.record(p,'TL-05','新团队 102 行样本翻三页，再搜索','每页 50、50、2 件，末页下一页禁用，搜索回到唯一种子。')
    space(p,'基线协作组')

def recovery(r):
    p=r.b
    click(p,'任务')
    pattern='**/api/workbench/transport*'
    def abort_reads(route):
        if route.request.method=='GET':
            route.abort('failed')
        else:
            route.continue_()
    p.route(pattern,abort_reads)
    try:
        field(p,'搜索任务').fill('断线查找')
        expect(p.locator('.team-connection-status').first).to_be_visible(timeout=25000)
    finally:
        p.unroute(pattern,abort_reads)
    p.evaluate("window.dispatchEvent(new Event('online'))")
    field(p,'搜索任务').fill('')
    expect(p.locator('.team-connection-status').first).not_to_be_visible(timeout=20000)
    r.ev.record(p,'COMMON-02','B 的业务读请求持续失败后恢复','出现连接状态提示，联网触发成功查询后提示消退，A 的网络仍正常。')

def role_sample(r):
    b=r.b
    sql_role="""update member m set role=:'role' from workspace w,public."user" u
        where m.workspace_id=w.id and m.user_id=u.id and w.slug=:'slug' and u.name=:'user'
        and m.role=:'prior' returning m.role;"""
    args={'slug':r.slug,'user':r.ub}
    assert sql(sql_role,role='admin',prior='member',**args)=='admin'
    try:
        b.reload()
        click(b,'成员与智能体')
        expect(btn(b,'邀请成员')).to_be_visible()
        r.ev.record(b,'IN-05','把本轮 B 从 member 临时改为 admin 后重载','管理员获得团队邀请操作。')
    finally:
        assert sql(sql_role,role='member',prior='admin',**args)=='member'
    b.reload()
    expect(btn(b,'邀请成员')).not_to_be_visible()


def secondary(r):
    from support import issue
    from tasks import TITLE
    a,b=r.a,r.b
    click(b,'成员与智能体')
    mine=b.get_by_role('tab',name=re.compile('我的智能体'))
    team=b.get_by_role('tab',name=re.compile('团队智能体'))
    mine.focus()
    mine.press('End')
    expect(team).to_be_focused()
    expect(team).to_have_attribute('aria-selected','true')
    team.press('Home')
    expect(mine).to_be_focused()
    r.ev.record(b,'AG-10','B 团队智能体目录按 End、Home','焦点与选中 tab 同步切换。')
    click(a,'成员与智能体')
    card=a.locator('.team-agent-row').filter(has_text='复验助手')
    click(card,'删除智能体')
    expect(dialog(a)).to_contain_text('复验助手')
    click(dialog(a),'取消')
    expect(a.get_by_text('复验助手',exact=True)).to_be_visible()
    r.ev.record(a,'AG-11','A 打开共享助手的删除确认并取消','确认包含名称，取消后助手仍在。')
    issue(a,TITLE)
    issue(b,TITLE)
    before=btn(a,re.compile('^(取消关注|关注)$')).inner_text()
    b_before=btn(b,re.compile('^(取消关注|关注)$')).inner_text()
    click(a,before)
    opposite='取消关注' if before=='关注' else '关注'
    expect(btn(a,opposite)).to_be_visible()
    b.reload()
    expect(btn(b,b_before)).to_be_visible()
    click(a,opposite)
    expect(btn(a,before)).to_be_visible()
    r.ev.record(a,'TD-01 TD-02','双方打开同一已分派任务，A 切换关注后恢复','本人关注操作可逆，B 重载仍保持其本人原订阅。')
    click(a.locator('.team-brief'),'编辑')
    d=dialog(a)
    title=field(d,'任务标题')
    expect(title).to_be_focused()
    expect(title).to_have_value(TITLE)
    title.fill(' ')
    expect(btn(d,'保存')).to_be_disabled()
    close(a)
    click(a.locator('.team-brief'),'编辑')
    expect(title).to_be_focused()
    expect(title).to_have_value(TITLE)
    body=field(d,'任务要求')
    old=body.input_value()
    body.fill(old+'（已核对）')
    expect(body).to_have_value(old+'（已核对）')
    expect(title).to_have_value(TITLE)
    click(d,'保存')
    expect(b.locator('.team-brief')).to_contain_text('（已核对）',timeout=16000)
    r.ev.record(b,'TD-03','A 编辑任务要求，空标题、取消、重新打开再保存','保留原值且空标题禁保存，B 同一任务自动更新。')
    click(b,'任务')
    click(b,re.compile('^我负责的'))
    expect(b.locator('.team-task-row').filter(has_text=TITLE)).to_have_count(1)
    click(b,re.compile('^我创建的'))
    expect(b.locator('.team-task-row').filter(has_text=TITLE)).to_have_count(0)
    field(b,'搜索任务').fill('没有对应的条目')
    expect(b.locator('.team-task-row')).to_have_count(0)
    click(b,'重置')
    expect(b.locator('.team-task-row').filter(has_text=TITLE)).to_have_count(1)
    r.ev.record(b,'TL-01 TL-02','B 在我负责/我创建之间切换并搜索无匹配内容','由 A 所创的任务仅出现在 B 的负责范围，重置恢复列表。')
    click(a,'智能体小队')
    click(a,re.compile('清单小队'))
    click(a,'编辑小队')
    expect(field(dialog(a),'小队名称')).to_have_value('清单小队')
    field(dialog(a),'小队名称').fill('未保存的名字')
    click(dialog(a),'取消')
    click(a,'角色说明')
    d=dialog(a)
    expect(d.locator('textarea')).to_be_visible()
    close(a)
    r.ev.record(a,'SQ-04 SQ-06','打开小队编辑及成员角色表单后取消','预填原小队名称和角色说明，取消后仍在原详情。')
    click(a,'移出')
    expect(dialog(a)).to_contain_text(r.ub)
    click(dialog(a),'取消')
    expect(a.locator('body')).to_contain_text('检查清单')
    click(a,'移出')
    click(dialog(a),'移出')
    expect(a.locator('body')).not_to_contain_text('检查清单')
    click(a,'归档小队')
    click(dialog(a),'取消')
    click(a,'归档小队')
    click(dialog(a),'归档小队')
    expect(dialog(a)).not_to_be_visible()
    click(b,'智能体小队')
    expect(btn(b,re.compile('清单小队'))).to_have_count(0)
    archived=sql("""select archived_at is not null from squad q join workspace w on q.workspace_id=w.id
        where w.slug=:'s' and q.name='清单小队';""",s=r.slug)
    assert archived=='t'
    r.ev.record(b,'SQ-07 SQ-08','A 先取消再确认移出非队长 B，随后归档本轮小队','成员角色从详情移除，数据库有归档时间，B 新列表不再显示该队。')
