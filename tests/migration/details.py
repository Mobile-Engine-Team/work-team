"""Exercise less common task detail paths on an isolated test workspace."""
import re
from playwright.sync_api import expect
from support import btn,click,close,dialog,field,issue,sql
from tasks import TITLE

def details(r):
    a,b=r.a,r.b
    b.evaluate("location.hash='#/team/absent-'+crypto.randomUUID()")
    cards=b.locator('.team-workspace-card')
    expect(cards.filter(has_text='基线协作组')).to_be_visible()
    cards.filter(has_text='基线协作组').click()
    expect(b.get_by_role('combobox',name='工作区')).to_contain_text('基线协作组')
    r.ev.record(b,'WS-02','同一账号打开不存在的 slug 后选团队卡片','合法团队可从选择页重新进入。')
    click(a,'成员与智能体')
    card=a.locator('.team-agent-row').filter(has_text='复验助手')
    click(card,'编辑智能体')
    d=dialog(a)
    picker=d.get_by_role('combobox',name='选择执行端')
    before=picker.text_content()
    picker.focus()
    picker.press('Enter')
    expect(a.get_by_role('listbox')).to_be_visible()
    a.keyboard.press('Escape')
    expect(a.get_by_role('listbox')).not_to_be_visible()
    expect(picker).to_be_focused()
    expect(picker).to_have_text(before)
    role=field(d,'角色指令')
    role.fill('归纳测试记录 · 离线修改')
    click(d,'保存')
    expect(card).to_contain_text('离线修改')
    r.ev.record(a,'AG-09 COMMON-01','已绑定离线 Pi 的助手打开端选择器，用回车/Esc 后只编辑角色指令',
        '原绑定仍显示、Esc 回焦到选择器，离线状态可保存该助手。')
    issue(b,TITLE)
    # A synthetic local provider remains offline. Suppressing the preview must create exactly a comment.
    click(b,'提及成员或智能体')
    b.get_by_role('option',name=re.compile('复验助手')).click()
    preview=b.locator('.team-trigger-preview')
    target=preview.get_by_role('checkbox',name='复验助手')
    expect(target).to_be_checked(timeout=12000)
    target.uncheck()
    click(b,'发送')
    expect(b.locator('[contenteditable=true]')).to_have_text('')
    count=sql("""select count(*) from agent_task_queue q join issue i on i.id=q.issue_id join workspace w on w.id=i.workspace_id
        where w.slug=:'s' and i.title=:'t';""",s=r.slug,t=TITLE)
    assert count=='0'
    r.ev.record(b,'CM-04','B 提及助手，取消勾选预估中的触发项再发送','评论成功入库，该任务没有产生执行。')
    parent=b.locator('article.team-entry-row').filter(has_text='两项约定已核对').first
    pid=parent.get_attribute('id')
    click(parent,'回复')
    click(b,'取消回复')
    expect(b.locator('.team-reply-target')).not_to_be_visible()
    click(parent,'回复')
    b.locator('.team-reply-target .team-reply-context').click()
    expect(parent).to_be_focused()
    b.locator('[contenteditable=true]').fill('引用首条评论复查')
    click(b,'发送')
    child=b.locator('article.team-entry-row').filter(has_text='引用首条评论复查').last
    expect(child).to_be_visible()
    child.locator('.team-reply-context').click()
    expect(parent).to_be_focused()
    r.ev.record(b,'CM-02','取消回复再回复同一评论并点击子回复的引用','引用返回父评论 '+pid+'，焦点与旧回复相符。')
    sql("""insert into activity_log(workspace_id,issue_id,actor_type,action,details)
        select w.id,i.id,'system','squad_leader_evaluated',jsonb_build_object('outcome','no_action','reason','本轮受控协调说明')
        from workspace w join issue i on i.workspace_id=w.id where w.slug=:'s' and i.title=:'t';""",s=r.slug,t=TITLE)
    b.reload()
    summary=b.get_by_text('查看原始协调说明',exact=True)
    summary.click()
    expect(b.get_by_text('本轮受控协调说明',exact=True)).to_be_visible()
    summary.click()
    expect(b.get_by_text('本轮受控协调说明',exact=True)).not_to_be_visible()
    r.ev.record(b,'CM-05','为本轮任务安装一条协调活动，再在详情展开/收起原文','能够阅读完整协调原因，收起后保留活动摘要。')
