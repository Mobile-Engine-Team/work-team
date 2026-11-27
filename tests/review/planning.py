"""Replay PL-03/04 and TC-05 using a synthetic, unconnected Pi runtime."""
import argparse
from datetime import datetime
import hashlib
import json
from pathlib import Path
import plistlib
import re
from urllib.error import HTTPError
from zoneinfo import ZoneInfo
from playwright.sync_api import sync_playwright, expect

from common import ROOT, RUNTIME, Review, api, button, click, open_page, seed, select, signin, sql


def run(out):
    review = Review(out)
    accounts, password, ws, _ = seed()
    a, b = accounts
    wsid = ws['id']
    project = api('POST', '/api/projects', a['token'], {'title': '规划联调', 'description': '合成输入与草案'}, wsid)['id']
    runtime = sql("""insert into agent_runtime(workspace_id,name,runtime_mode,provider,owner_id,status,metadata,last_seen_at)
        values (:'ws','规划回放 Pi','local','pi',:'owner','online','{"capabilities":["project-planning-pi-v1"]}',now())
        returning id""", ws=wsid, owner=a['user']['id'])
    agent = api('POST', '/api/agents', a['token'], {'name':'规划复验助手','instructions':'只输出结构建议','runtime_id':runtime,'model':''}, wsid)
    contents = RUNTIME/'desktop/Team Workbench.app/Contents'
    bundle = contents/'Resources/product'
    review.report.update(accounts={role:account['user']['name'] for role,account in zip('AB',accounts)},
                         workspace=ws['slug'], project=project, runtime=runtime, agent=agent['id'],
                         surface='Chrome 1180×810, DPR 2', build=plistlib.loads((contents/'Info.plist').read_bytes())['WorkbenchBuild'],
                         started=datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds'),
                         executor='受控本机响应。运行时登记用独立合成行；领取、取消与结果回写走冻结 Multica API。')
    review.report['rendererSha256'] = {str(p.relative_to(bundle)): hashlib.sha256(p.read_bytes()).hexdigest()
                                      for p in sorted(bundle.glob('packages/ui-*/dist/client.js'))}
    assert len(review.report['rendererSha256']) == 5
    review.report['requests'] = []
    review.save()

    def touch():
        sql("update agent_runtime set status='online',last_seen_at=now() where id=:'rt' and owner_id=:'owner'",rt=runtime,owner=a['user']['id'])

    def claim(purpose):
        request = api('POST', '/api/daemon/runtimes/'+runtime+'/planning/claim', a['token'], {}, wsid)['request']
        assert request and request['purpose'] == purpose
        stored = json.loads(sql("""select json_build_object('request',id,'status',status,'purpose',input->>'purpose',
          'requestKey',request_id,'baseRevision',base_revision,'inputHash',input_hash,'owner',created_by,'runtime',runtime_id)
          from project_planning_request where id=:'id' and project_id=:'project'""", id=request['id'], project=project))
        assert stored['status']=='running' and stored['owner']==a['user']['id'] and stored['runtime']==runtime
        review.report['requests'].append(stored)
        review.save()
        return request

    def respond(request, output):
        return api('POST', '/api/project-planning-results/'+request['id'], request['token'],
                   {'run_id':request['run_id'], 'output':json.dumps(output, ensure_ascii=False)})['status']

    def read_graph():
        return json.loads(sql("select json_build_object('revision',revision,'status',status,'nodes',graph->'nodes','edges',graph->'edges') from project_blueprint_draft where project_id=:'p'",p=project))

    def published():
        return int(sql("select count(*) from project_blueprint_version where project_id=:'p'",p=project))

    with sync_playwright() as pw:
        p = open_page(pw, 'a', None)
        p.set_default_timeout(12000)
        signin(p, a, password, ws['slug'])
        d = p.get_by_role('dialog')
        try:
            resources = p.evaluate("""performance.getEntriesByType('resource').map(r => r.name)
                .filter(u => new URL(u).pathname === '/plugins/' && u.includes('@team-workbench/'))""")
            batches = [p.request.get(url).body() for url in set(resources)]
            for path in review.report['rendererSha256']:
                content = (bundle/path).read_bytes().strip()
                assert any(content in batch for batch in batches), 'Host and packaged renderer differ at '+path
            review.report['servedPluginsMatchBundle'] = True
            click(p,'项目')
            click(p,re.compile('规划联调'))
            click(p,'施工蓝图')
            click(p,'编辑草案')
            click(p,'用 AI 调整蓝图')
            select(p,'选择一个个体智能体','规划复验助手')
            d.get_by_role('textbox',name='准备调整哪些工作').fill('新增核对清单的两项任务')
            click(d,'查看本次发送的输入')
            expect(button(d,'生成蓝图调整方案')).to_be_enabled()
            d.get_by_role('textbox',name='准备调整哪些工作').fill('新增交接校验与交接复查')
            expect(button(d,'生成蓝图调整方案')).to_be_disabled()
            click(d,'查看本次发送的输入')
            before=read_graph()
            def generate():
                touch()
                click(d,'生成蓝图调整方案')
                expect(d.get_by_text('等待执行端',exact=True).first).to_be_visible()

            generate()
            first = claim('blueprint')
            expect(d.get_by_text('正在生成',exact=True).first).to_be_visible(timeout=9000)
            click(d,'取消')
            expect(d.get_by_text('已取消',exact=True).first).to_be_visible()
            try:
                respond(first, {})
                raise AssertionError('Late result should be rejected')
            except HTTPError as error:
                assert error.code == 409
            review.check('PL-02 PL-03','改动已预览的输入；请求排队、测试端领取后 A 取消',
                         '改输入使生成按钮失效。重新预览后产生带 revision、hash 及用户请求键的记录；UI 经等待、生成中至已取消，已取消请求的迟到回执被拒绝。')
            click(d,'查看本次发送的输入')
            generate()
            invalid = claim('blueprint')
            assert respond(invalid, {'schema_version':0, 'changes':[]}) == 'failed'
            expect(d.get_by_text('生成失败',exact=True)).to_be_visible()
            error=d.locator('.project-planning-error')
            expect(error).to_be_visible()
            failure=error.inner_text().strip()
            assert failure and read_graph()==before
            review.check('PL-03','执行端返回无效的结构化建议',f'显示生成失败及服务端原因“{failure}”，草案未变。')
            click(d,'查看本次发送的输入')
            generate()
            second = claim('blueprint')
            changes=[]
            for number,title in enumerate(('交接校验','交接复查'),1):
                changes.append({'id':f'c{number}','kind':'add','reason':'按交接项留档',
                                'node':{'id':f'new{number}','title':title,'requirements':'登记签收','position':{'x':number*160,'y':50}}})
            changes.append({'id':'e','kind':'add_edge','reason':'核验后再复查','edge':{'id':'edge','from':'new1','to':'new2','handoff':'核对记录'}})
            assert respond(second, {'schema_version':1,'changes':changes,'questions':['由谁签收？']}) == 'succeeded'
            expect(d.get_by_text('交接校验',exact=True).first).to_be_visible()
            d.get_by_text('此前的规划请求', exact=True).click()
            click(d,re.compile('规划复验助手 · 生成失败'))
            expect(d.locator('.project-planning-error')).to_have_text(failure)
            click(d,re.compile('规划复验助手 · 建议已返回'))
            d.get_by_text('此前的规划请求', exact=True).click()
            expect(d.get_by_text('交接校验',exact=True).first).to_be_visible()
            assert read_graph()==before and published()==0
            cards=d.locator('label.project-suggestion')
            pick=lambda name: cards.filter(has_text=name).locator('input')
            pick('核验后再复查').check()
            click(d,'预览选中的蓝图修改')
            expect(d.get_by_text('操作未完成',exact=True)).to_be_visible()
            assert read_graph()==before
            pick('核验后再复查').uncheck()
            pick('交接校验').check()
            click(d,'预览选中的蓝图修改')
            expect(d.get_by_text('选中修改后的蓝图预览',exact=True)).to_be_visible()
            pick('交接复查').check()
            expect(button(d,re.compile('采用选中建议'))).to_be_disabled()
            pick('交接复查').uncheck()
            click(d,'预览选中的蓝图修改')
            review.shot(p,'adoption-preview')
            with p.expect_response(lambda r: 'apply-suggestion' in r.url) as applied:
                click(d,re.compile('采用选中建议'))
            assert applied.value.ok
            after=read_graph()
            assert after['revision']>before['revision'] and [n['title'] for n in after['nodes']]==['交接校验'],after
            assert not after['edges'] and published()==0
            assert sql("select count(*) from issue where project_id=:'p' and title in ('交接校验','交接复查')",p=project)=='0'
            state=api('GET',f'/api/projects/{project}/blueprint/draft',b['token'],workspace=wsid)
            assert '交接校验' in json.dumps(state,ensure_ascii=False)
            expect(d.get_by_text(re.compile('建议基于较早草案'))).to_be_visible()
            try:
                api('POST',f'/api/projects/{project}/blueprint/draft/apply-suggestion',a['token'],
                    {'request_id':second['id'],'selected':['c2'],'expected_revision':before['revision']}, wsid)
                raise AssertionError('Stale revision should be rejected')
            except HTTPError as error:
                assert error.code == 409
            assert read_graph()==after
            review.check('PL-04','受控返回两项新增及一项依赖，仅选择依赖、改选任务、再预览并采纳一项',
                         '缺少端点的依赖被拒，草案未变。改选使预览失效。只采纳“交接校验”，B 读到同一草案；正式版、对应业务任务均为 0。', image='adoption-preview')
            review.report['blueprint']={'before':before,'after':after,'publishedVersions':published(),'createdTasks':0}
            review.check('PL-03 PL-04','历史请求切换与旧草案 revision 重放','切换历史失败/成功项时返回各自结果。采用一项后界面提示建议已过时；用原 revision 采用另项被服务端拒绝 409，草案保持不变。')
            review.save()
            if d.count():
                p.keyboard.press('Escape')
            click(p,'项目')
            click(p,re.compile('规划联调'))
            click(p,'开始讨论')
            click(p,'新建话题')
            d.get_by_role('textbox').first.fill('交接范围')
            d.get_by_role('textbox').last.fill('先校验，再复查')
            click(d,re.compile('创建|新建'))
            click(p,'整理结论')
            select(p,'选择一个个体智能体','规划复验助手')
            def generate_conclusion():
                touch()
                click(d,'用 AI 起草结论')
                expect(d.get_by_text('等待执行端',exact=True).first).to_be_visible()
            generate_conclusion()
            click(d,'取消')
            expect(d.get_by_text('已取消',exact=True).first).to_be_visible()
            generate_conclusion()
            answer=claim('conclusion')
            draft='已确认：先校验。待讨论：复查负责人。建议：留存签收记录。'
            assert respond(answer,{'draft':draft})=='succeeded'
            expect(d.get_by_text(draft,exact=True)).to_be_visible()
            click(d,'将 AI 草稿追加到编辑区')
            expect(d.get_by_role('textbox').first).to_have_value(draft)
            assert sql("select conclusion_revision from project_topic where project_id=:'p' and title='交接范围'",p=project)=='0'
            review.shot(p,'conclusion-inserted')
            click(d,'保留草稿')
            click(p,'整理结论')
            expect(d.get_by_role('textbox').first).to_have_value(draft)
            topic=api('GET',f'/api/projects/{project}/topics',b['token'],workspace=wsid)['topics'][0]
            assert topic['status']=='open' and topic['conclusion_revision']==0 and topic['conclusion']==''
            assert topic['conclusion_draft']==draft and topic['draft_revision']>0
            review.report['topic']={k:topic[k] for k in ('id','status','conclusion','conclusion_revision','conclusion_draft','draft_revision')}
            review.check('TC-05','本地排队后取消，重新生成；本机受控结果插入可编辑正文后保留草稿',
                         '重开后可编辑正文完整；确认版本仍为 0，话题仍开放。', image='conclusion-inserted')
        except Exception:
            (out/'failure.txt').write_text(p.locator('body').aria_snapshot())
            raise
        finally:
            sql("update agent_runtime set status='offline' where id=:'rt' and owner_id=:'u'",rt=runtime,u=a['user']['id'])
            p.context.browser.close()
    review.report['status']='pass'
    review.report['finished']=datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds')
    review.report['images']={path.name:hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(out.glob('*.png'))}
    (out/'failure.txt').unlink(missing_ok=True)
    review.save()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'.local/review/planning')
    run(parser.parse_args().output)
