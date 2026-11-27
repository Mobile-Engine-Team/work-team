from hashlib import sha256
import re

from playwright.sync_api import expect

from support import btn, click, choose_file, close, combo, dialog, field, issue, login, seed_history, space, sql, wait_sql

TITLE='核对交接清单'
INPUT='复验附件 A B'.encode()
ISSUE_STATE="""select i.status,count(q.id) from workspace w join issue i on i.workspace_id=w.id
    left join agent_task_queue q on q.issue_id=i.id where w.slug=:'s' and i.title=:'t' group by i.id;"""
RUN_STATE="""select i.status,q.status,(q.started_at is not null)::int from workspace w
    join issue i on i.workspace_id=w.id join agent_task_queue q on q.issue_id=i.id
    where w.slug=:'s' and i.title=:'t' order by q.created_at desc limit 1;"""

def tasks(r):
    a,b=r.a,r.b
    click(a,'任务')
    click(a,'新建任务')
    d=dialog(a)
    expect(field(d,'任务标题')).to_have_value('')
    expect(btn(d,'创建任务')).to_be_disabled()
    r.ev.record(a,'TK-01','团队任务列表新建普通任务','标题为空，创建按钮禁用。','11')
    click(d,'智能体起草')
    r.ev.record(a,'TK-07','切换智能体起草模式','起草表单可达，未提交模型请求。','12')
    click(d,'手动创建')
    field(d,'任务标题').fill('暂存')
    close(a)
    click(a,'新建任务')
    expect(field(d,'任务标题')).to_have_value('')
    r.ev.record(a,'TK-03 STATE-04','新任务写标题后按 Esc 再开','表单重置。')
    # The adapter keeps the original upload-file route as part of its same-origin request.
    fault=re.compile(r'upload-file')
    def abort_upload(route):
        if route.request.method=='POST':
            route.abort('failed')
        else:
            route.continue_()
    for action in ['移除','取消','重试']:
        a.route(fault,abort_upload)
        try:
            choose_file(d,'fault.txt',b'local failure')
            expect(btn(d,'重试')).to_be_enabled()
        finally:
            a.unroute(fault,abort_upload)
        if action=='移除':
            click(d,re.compile('移除'))
            expect(d).not_to_contain_text('fault.txt')
        elif action=='取消':
            close(a)
            click(a,'新建任务')
        else:
            click(d,'重试')
            expect(btn(d,'重试')).not_to_be_visible()
            expect(d).to_contain_text('fault.txt')
            close(a)
            click(a,'新建任务')
        r.ev.record(a,'D-07 FL-01','新建任务仅上传失败，恢复连接后'+action,'失败附件允许'+action+'，普通任务仍可编辑。')
    field(d,'任务标题').fill(TITLE)
    field(d,'任务要求').fill('请核对附件中的两项约定')
    combo(d,'负责人',re.compile(r.ub))
    choose_file(d,'baseline.txt',INPUT)
    expect(btn(d,'创建任务')).to_be_enabled()
    expect(d).to_contain_text('待发送')
    r.ev.record(a,'TK-04','上传输入文件，尚未提交任务','附件显示待发送，创建按钮可用。')
    click(d,'创建任务')
    expect(btn(a,'返回任务列表')).to_be_visible()
    expect(btn(a,'baseline.txt')).to_be_visible()
    assert sql(ISSUE_STATE,s=r.slug,t=TITLE)=='backlog|0'
    r.ev.record(a,'TK-02 TK-05','A 创建任务、要求、文本附件并指派 B','落在新任务详情，持久化业务状态 backlog，执行 0 条。','13')
    click(b,'收件箱')
    expect(b.locator('body')).to_contain_text(TITLE)
    r.ev.record(b,'IB-01','B 访问自己的团队收件箱','看到 A 新分派的任务。','14')
    click(b,'归档')
    click(b,'已归档')
    expect(btn(b,'恢复通知')).to_be_visible()
    click(b,'恢复通知')
    click(b,'当前通知')
    r.ev.record(b,'IB-03','归档通知，再从归档分区恢复','恢复后手动切回当前，任务可打开。')
    click(b,'打开任务')
    expect(btn(b,'返回任务列表')).to_be_visible()
    b.locator('[contenteditable=true]').fill('两项约定已核对')
    click(b,'发送')
    expect(a.get_by_text('两项约定已核对',exact=True).first).to_be_visible(timeout=20000)
    click(a,'baseline.txt')
    expect(dialog(a)).to_contain_text('复验附件 A B')
    r.ev.record(a,'CM-01 FL-02','B 评论后 A 查看附件','A 不刷新即可见 B 评论，打开输入材料可读完整原文。','15')
    download=r.private/'download'
    download.mkdir(exist_ok=True)
    target=download/'baseline.txt'
    if r.mode=='browser':
        with a.expect_download() as event:
            click(a,'下载')
        assert event.value.suggested_filename=='baseline.txt'
        event.value.save_as(target)
    else:
        session=a.context.new_cdp_session(a)
        session.send('Browser.setDownloadBehavior',{'behavior':'allow','downloadPath':str(download)})
        click(a,'下载')
        for _ in range(120):
            if target.exists() and target.read_bytes()==INPUT:
                break
            a.wait_for_timeout(100)
    assert target.read_bytes()==INPUT
    r.ev.business('download',{'bytes':len(INPUT),'sha256':sha256(target.read_bytes()).hexdigest()})
    close(a)
    combo(b,'状态','已完成')
    wait_sql(ISSUE_STATE,'done|0',s=r.slug,t=TITLE)
    b.locator('[contenteditable=true]').fill('不应恢复的评论')
    b.reload()
    expect(btn(b,'baseline.txt')).to_be_visible()
    expect(b.locator('[contenteditable=true]')).to_have_text('')
    r.ev.record(b,'TD-04 STATE-01 STATE-02 STATE-05','保存已完成后写一条未发评论并刷新','回到同一任务，材料与已发评论仍在，未发送输入清空，数据库 done 且无执行。','16')
    for index,content in enumerate([b'first',b'second'],start=1):
        click(b,'回复')
        b.locator('[contenteditable=true]').fill(f'第{index}次交付')
        choose_file(b,'review.txt',content)
        click(b,'发送')
        expect(b.get_by_text(f'第{index}次交付',exact=True).first).to_be_visible()
    history=b.get_by_text('历史版本 · 1',exact=True)
    expect(history).to_be_visible()
    r.ev.record(b,'FL-03 FL-04 FL-05','B 两次交付同名同 MIME 的 review.txt','最新版本单列，历史折叠显示 1 份。','39')
    history.click()
    b.locator('.team-version-history button').last.click()
    active=b.evaluate('document.activeElement.id')
    assert active and 'comment' in active
    r.ev.record(b,'FL-06','从已展开的早期版本定位评论','焦点进入旧评论 '+active)
    data=sql("""select a.filename,a.size_bytes,a.comment_id is not null from attachment a
        join workspace w on a.workspace_id=w.id where w.slug=:'s'
        and (a.issue_id=(select id from issue where workspace_id=w.id and title=:'t') or
        a.comment_id in(select c.id from comment c join issue i on i.id=c.issue_id where i.workspace_id=w.id and i.title=:'t'))
        order by a.created_at;""",s=r.slug,t=TITLE).splitlines()
    assert data==['baseline.txt|16|f','review.txt|5|t','review.txt|6|t'],data
    r.ev.business('attachments',data)
    click(a,'收件箱')
    a.locator('.team-inbox-history summary').first.click()
    expect(a.locator('.team-inbox-event button').first).to_be_visible()
    r.ev.record(a,'IB-01 IB-02','A 展开同任务的此前通知','同任务聚合，历史内有各事件的独立操作。','31')
    a.locator('.team-inbox-event button').first.click()
    expect(btn(a,'返回任务列表')).to_be_visible()
    click(b,'任务')
    field(b,'搜索任务').fill('交接')
    click(b,'重置')
    expect(field(b,'搜索任务')).to_have_value('')
    expect(btn(b,'新建任务')).to_be_visible()
    click(b,'新建任务')
    field(dialog(b),'任务标题').fill('待核对事项')
    click(dialog(b),'创建任务')
    click(b,'返回任务列表')
    click(b,'看板视图')
    expect(b.locator('.team-task-card').filter(has_text='待核对事项')).to_be_visible()
    r.ev.record(b,'TL-03 TL-04 D-07','重置搜索再切看板','筛选重置后留在任务页，切换为看板。','29')
    b.reload()
    expect(btn(b,'新建任务')).to_be_visible()
    assert 'taskView=board' in b.url
    r.ev.record(b,'STATE-09','刷新团队任务看板','保留看板路由。')

def identity(r):
    a=r.a
    seed_history(r.slug,r.ua)
    click(a,'新对话')
    a.reload()
    click(a,'复验已存回答')
    click(a,'固定为我的视图')
    expect(btn(a,'继续调整')).to_be_visible()
    click(a,'新对话')
    draft=a.locator('textarea').last
    draft.fill('属于 A 的私人草稿')
    draft.press('Shift+Enter')
    draft.press('X')
    original=draft.input_value()
    assert '\n' in original
    a.reload()
    expect(draft).to_have_value(original)
    click(a,'退出账号')
    login(a,r.ub,r.password)
    space(a,'基线协作组')
    expect(draft).to_have_value('')
    expect(btn(a,'复验已存回答')).to_have_count(0)
    expect(btn(a,'交接快照')).to_have_count(0)
    issue(a,TITLE)
    expect(btn(a,'baseline.txt')).to_be_visible()
    r.ev.record(a,'D-01 WB-03 WB-09 WB-19 STATE-03','同一窗口同一份资料从 A 退出并登录 B','B 能打开团队任务；A 的多行草稿、历史对话及固定视图均不可见。',role='B（A 实例）')
    click(a,'退出账号')
    login(a,r.ua,r.password)
    space(a,'基线协作组')
    expect(draft).to_have_value(original)
    expect(btn(a,'复验已存回答')).to_be_visible()
    expect(btn(a,'交接快照')).to_be_visible()
    r.ev.record(a,'D-01 STATE-03','同资料切回 A','原草稿和私人对象回来，排除因登出而被删除的误判。')

def squad(r):
    a,b=r.a,r.b
    click(a,'智能体小队')
    click(a,re.compile('新建小队|创建小队'))
    d=dialog(a)
    field(d,'小队名称').fill('清单小队')
    combo(d,'选择队长',re.compile('复验助手'))
    click(d,'创建小队')
    expect(d).not_to_be_visible()
    expect(a.locator('body')).to_contain_text('清单小队')
    r.ev.record(a,'SQ-01 SQ-02 SQ-03','创建清单小队并选择共享助手为队长','小队名称和队长可见。','24')
    if not btn(a,'添加成员').is_visible():
        click(a,re.compile('清单小队'))
    click(a,'添加成员')
    d.get_by_role('combobox').last.click()
    a.get_by_role('option',name=re.compile(r.ub)).click()
    d.locator('textarea').fill('检查清单')
    click(d,'保存')
    expect(d).not_to_be_visible()
    click(b,'智能体小队')
    click(b,re.compile('清单小队'))
    expect(b.locator('body')).to_contain_text('检查清单')
    r.ev.record(b,'SQ-05 SQ-06','A 将 B 加入小队后，B 打开详情','B 可见本人的角色说明。')

def dispatch(r):
    a,b=r.a,r.b
    def create(title):
        click(b,'任务')
        click(b,'新建任务')
        d=dialog(b)
        field(d,'任务标题').fill(title)
        combo(d,'负责人',re.compile('复验助手'))
        click(d,'创建任务')
        expect(btn(b,'返回任务列表')).to_be_visible()
        assert sql(ISSUE_STATE,s=r.slug,t=title)=='backlog|0'
        combo(b,'状态','进行中')
        expect(dialog(b)).to_be_visible()
    title='离线分派'
    create(title)
    r.ev.record(b,'RUN-01','B 给离线共享助手建待规划任务再改进行中','创建时无执行；推进前显示确认框。','33')
    click(dialog(b),'确认并开始')
    expect(btn(b,'停止')).to_be_visible()
    wait_sql(RUN_STATE,'in_progress|queued|0',s=r.slug,t=title)
    r.ev.record(b,'RUN-02 STATE-07','B 确认离线分派','任务进行中、执行排队中、尚未领取。','34')
    issue(a,title)
    expect(btn(a,'停止')).not_to_be_visible()
    r.ev.record(a,'RUN-07','助手所属人 A 打开 B 发起的执行任务','A 可见业务任务，无 B 的私有停止操作。')
    issue(a,TITLE)
    click(a,'提及成员或智能体')
    a.get_by_role('option',name=re.compile(re.escape(r.ub))).click()
    editor=a.locator('[contenteditable=true]')
    editor.press('End')
    editor.press('Space')
    editor.press_sequentially('verify')
    click(a,'发送')
    click(b,'收件箱')
    expect(b.locator('body')).to_contain_text('在评论中提及了你',timeout=18000)
    unread_sql='''select count(*) from inbox_item n join workspace w on w.id=n.workspace_id
        join public."user" u on u.id=n.recipient_id where w.slug=:'s' and u.name=:'user' and not n.read and not n.archived;'''
    unread=sql(unread_sql,s=r.slug,user=r.ub)
    assert int(unread)>0
    r.ev.record(b,'CM-03 IB-04 STATE-06','A 提及 B，B 留未读时退出前取样','B 看到提及事件，服务端未读事件数 '+unread+'。','36')
    if r.mode=='native':
        b=r.reopen_b()
        expect(field(b,'账号')).to_have_value('')
        expect(b.locator('input[type=password]')).to_have_value('')
        r.ev.record(b,'STATE-01','正常退出 B，再打开同一 bundle 与资料','原进程结束后重开显示空登录框。','32')
        login(b,r.ub,r.password)
        space(b,'基线协作组')
    else:
        b.reload()
    click(b,'收件箱')
    expect(b.locator('body')).to_contain_text('在评论中提及了你',timeout=15000)
    assert sql(unread_sql,s=r.slug,user=r.ub)==unread
    issue(b,title)
    expect(btn(b,'停止')).to_be_visible()
    assert sql(RUN_STATE,s=r.slug,t=title)=='in_progress|queued|0'
    r.ev.record(b,'STATE-07','B 重开或刷新后回到离线任务','相同任务继续排队，停止操作仍可用。','37')
    click(b,'查看详情')
    expect(dialog(b)).to_be_visible()
    close(b)
    click(b,'停止')
    wait_sql(RUN_STATE,'in_progress|cancelled|0',s=r.slug,t=title)
    expect(btn(b,'重试')).to_be_visible()
    r.ev.record(b,'RUN-04 RUN-07','查看执行详情后停止','执行取消，业务状态仍进行中，提供重试。','35')
    click(b,'重试')
    wait_sql(RUN_STATE,'in_progress|queued|0',s=r.slug,t=title)
    click(b,'停止')
    wait_sql(RUN_STATE,'in_progress|cancelled|0',s=r.slug,t=title)
    assert sql(ISSUE_STATE,s=r.slug,t=title)=='in_progress|2'
    create('暂不启动')
    click(dialog(b),'暂不开始')
    wait_sql(ISSUE_STATE,'in_progress|0',s=r.slug,t='暂不启动')
    r.ev.record(b,'RUN-03 RUN-05','B 重试并取消原执行，再为另一件选暂不开始','首件有两个未领取的取消执行，第二件进行中且执行数 0。')

def online(r):
    a,b=r.a,r.b
    click(a,'成员与智能体')
    click(a,'启用本机执行端')
    try:
        expect(btn(a,'停用本机执行端')).to_be_visible(timeout=30000)
        click(a,'新建智能体')
        d=dialog(a)
        field(d,'名称').fill('本地回执验证')
        combo(d,'选择执行端',re.compile('Codex',re.I))
        d.get_by_role('checkbox').check()
        click(d,'保存')
        expect(d).not_to_be_visible()
        click(b,'任务')
        click(b,'新建任务')
        d=dialog(b)
        field(d,'任务标题').fill('受控回执')
        combo(d,'负责人',re.compile('本地回执验证'))
        click(d,'创建任务')
        expect(btn(b,'返回任务列表')).to_be_visible()
        assert sql(ISSUE_STATE,s=r.slug,t='受控回执')=='backlog|0'
        combo(b,'状态','进行中')
        click(dialog(b),'确认并开始')
        # The fixture models just the Codex stdio protocol. The actual daemon, assignment and queue remain in use.
        result_query="""select q.status,q.started_at is not null,q.completed_at is not null,u.name,
             q.originator_source,i.status from agent_task_queue q join issue i on i.id=q.issue_id
             join workspace w on w.id=i.workspace_id join public."user" u on u.id=q.accountable_user_id
             where w.slug=:'s' and i.title='受控回执';"""
        from time import monotonic
        observed=[]
        until=monotonic()+50
        while monotonic()<until:
            row=sql(result_query,s=r.slug)
            if row and (not observed or row!=observed[-1]):
                observed.append(row)
            if row.startswith('completed|'):
                break
            b.wait_for_timeout(100)
        r.ev.business('controlledRun',observed)
        assert observed and observed[-1].startswith('completed|t|t|'+r.ub+'|'),observed
        expect(b.locator('body')).to_contain_text('WORKBENCH_FIXTURE_OK',timeout=18000)
        r.ev.record(b,'RUN-06 D-06','B 分派给 A 的在线 Codex 协议夹具并确认开始',
            'Multica 持久记录开始/结束、责任人 B 与执行终态，B 在任务详情读到 WORKBENCH_FIXTURE_OK。')
    finally:
        click(a,'成员与智能体')
        if btn(a,'停用本机执行端').is_visible():
            click(a,'停用本机执行端')
            expect(btn(a,'启用本机执行端')).to_be_visible(timeout=15000)
