"""Exercise personal execution, the system file chooser and agent ownership on the standalone .app."""
import argparse
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import subprocess as sp
import sys
import time

from playwright.sync_api import expect, sync_playwright
from shell import DEFAULT, LAB, ROOT, ax, eventually, launch, quit_process, wait_page
sys.path.insert(0,str(ROOT/'tests/migration'))
from support import btn, click, close, combo, dialog, field, login
from workspaces import register

def sql(app,statement,**variables):
    env={'PGPASSWORD':(LAB/'db-password').read_text().strip()}
    command=[app/'Contents/Resources/product/libexec/pg-tools/bin/psql','-XqAt','-h','127.0.0.1','-p','54459',
             '-U','workbench','-d','workbench','-v','ON_ERROR_STOP=1']
    for key,value in variables.items():
        command.extend(['-v',key+'='+value])
    return sp.check_output(command,input=statement,env=env,text=True).strip()

def close_system_picker(pid):
    eventually(lambda: ax(pid,'get count of sheets of window 1')=='1',12)
    for label in ('Cancel','取消'):
        if ax(pid, f'exists button "{label}" of sheet 1 of window 1')=='true':
            ax(pid, f'click button "{label}" of sheet 1 of window 1')
            break
    else:
        # NSSavePanel may put its Cancel button below a split-view AX group.
        ax(pid,'set frontmost to true\nkey code 53')
    eventually(lambda: ax(pid,'get count of sheets of window 1')=='0')

def run(app,out):
    out.mkdir(parents=True,exist_ok=True)
    user='native_'+str(int(time.time()))
    result={'bundle':app.name,'build':plistlib.loads((app/'Contents/Info.plist').read_bytes())['WorkbenchBuild'],
            'profile':'isolated-replay/a','syntheticUser':user,'checks':[]}
    def add(ids,detail):
        result['checks'].append({'ids':ids.split(),'observed':detail})
        (out/'agents.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
        print('PASS',ids,flush=True)
    def active_tokens():
        return sql(app,"select count(*) from personal_access_token t join public.\"user\" u on u.id=t.user_id where u.name=:'u' and not t.revoked;",u=user)
    def runtimes():
        return sql(app,"select provider||'|'||r.id||'|'||daemon_id from agent_runtime r join public.\"user\" u on u.id=r.owner_id where u.name=:'u' order by provider;",u=user).splitlines()

    with sync_playwright() as driver:
        pid=launch(app)
        page=wait_page(driver)
        try:
            password=secrets.token_urlsafe(20)
            register(page,user,password)
            click(page,'成员与智能体')
            click(page,'连接远程主机')
            d=dialog(page)
            expect(field(d,'远端可访问的协作服务地址')).to_have_value('http://127.0.0.1:19115')
            expect(d.get_by_role('spinbutton')).to_have_value('22')
            expect(btn(d,'连接远程主机')).to_be_disabled()
            field(d,'主机地址').fill('127.0.0.1')
            field(d,'主机用户名').fill('workbench')
            combo(d,'认证方式','选择私钥文件')
            click(d,'连接远程主机')
            close_system_picker(pid)
            expect(d).to_contain_text('连接已取消')
            assert active_tokens()=='0'
            add('EP-04 EP-06',{'keyDialog':'取消','host':'127.0.0.1','port':22,'residualTokens':0})
            close(page)

            click(page,'启用本机执行端')
            expect(btn(page,'停用本机执行端')).to_be_visible(timeout=45000)
            expect(page.locator('.team-cli-row')).to_have_count(4,timeout=35000)
            provider=sorted(page.locator('.team-cli-row small').all_text_contents())
            assert provider==['claude','codex','opencode','pi'],provider
            initial=runtimes()
            add('EP-01 EP-02', {'providers':provider, 'runtimeBindings':initial})

            def agent_form():
                click(page,'新建智能体')
                dialog_box=dialog(page)
                assert dialog_box.get_by_role('checkbox').count()==0
                combo(dialog_box,'选择执行端',re.compile('Codex',re.I))
                field(dialog_box,'名称').fill('个人复验员')
                click(dialog_box,'保存')
            agent_form()
            expect(d).not_to_be_visible()
            agent_form()
            expect(d).to_contain_text('该工作区已有同名的在用智能体')
            assert field(d,'名称').input_value()=='个人复验员'
            close(page)
            count=sql(app,"select count(*) from agent a join public.\"user\" u on u.id=a.owner_id where u.name=:'u' and a.name='个人复验员';",u=user)
            assert count=='1'
            add('AG-01 AG-12', {'sameNameRejected':True,'matchingAgents':1})

            click(page,re.compile('测试模型调用'))
            expect(d).to_contain_text('测试模型调用')
            click(d,'测试模型调用')
            expect(d.get_by_role('status').filter(has_text='模型调用通过')).to_be_visible(timeout=65000)
            click(d,'重新测试')
            expect(d.get_by_role('status').filter(has_text='模型调用通过')).to_be_visible(timeout=65000)
            add('PRB-01 PRB-02', {'provider':'codex','executor':'fixture-codex','result':'模型调用通过','repeat':'模型调用通过'})
            close(page)
            click(page,'更多操作')
            page.get_by_role('menuitem',name='认证与配置').click()
            expect(d).to_contain_text('Codex 模型认证')
            click(d,'导入已有登录')
            close_system_picker(pid)
            expect(btn(d,'导入已有登录')).to_be_enabled()
            add('PRB-03', {'model':'Codex','nativeDialog':'取消导入'})
            close(page)

            # The same owner on a second client now reaches the remote probe queue.
            other_pid=launch(app,'b',19886)
            try:
                other=wait_page(driver,19886)
                login(other,user,password)
                click(other,'成员与智能体')
                click(other,re.compile('测试模型调用'))
                od=dialog(other)
                click(od,'测试模型调用')
                click(od,'取消测试')
                expect(od).to_contain_text('测试已取消',timeout=12000)
                state=sql(app,"select status from project_planning_request r join public.\"user\" u on u.id=r.created_by where u.name=:'u' and r.input->>'purpose'='model_probe' order by r.created_at desc limit 1;",u=user)
                assert state=='cancelled',state
                add('PRB-01 PRB-02',{'otherClient':'b','queueResult':state,'owner':user})
            finally:
                quit_process(other_pid)

            click(page,'停用本机执行端')
            expect(btn(page,'启用本机执行端')).to_be_visible()
            click(page,'新建智能体')
            d.get_by_role('combobox',name='选择执行端').click()
            options=page.get_by_role('option')
            expect(options).to_have_count(4,timeout=30000)
            for index in range(4):
                expect(options.nth(index)).to_have_attribute('aria-disabled','true',timeout=30000)
            page.keyboard.press('Escape')
            close(page)
            click(page,re.compile('编辑智能体'))
            expect(d.get_by_role('combobox',name='选择执行端')).to_contain_text('Codex')
            field(d,'名称').fill('个人复验员离线改名')
            field(d,'角色指令').fill('离线编辑后保留绑定')
            click(d,'保存')
            expect(d).not_to_be_visible()
            expect(page.get_by_text('离线编辑后保留绑定',exact=True)).to_be_visible()
            expect(page.get_by_text('个人复验员离线改名',exact=True)).to_be_visible()
            bound=sql(app,"select r.provider||'|'||a.runtime_id from agent a join agent_runtime r on r.id=a.runtime_id join public.\"user\" u on u.id=a.owner_id where u.name=:'u' and a.name='个人复验员离线改名' and a.instructions='离线编辑后保留绑定';",u=user)
            assert any(row.startswith(bound+'|') for row in initial) and bound.startswith('codex|')
            add('AG-09',{'originalOfflineBinding':bound,'savedName':'个人复验员离线改名','editedInstructions':True})
            click(page,'启用本机执行端')
            expect(btn(page,'停用本机执行端')).to_be_visible(timeout=45000)
            assert runtimes()==initial
            add('EP-03 STATE-10',{'offlineOptions':4,'sameRuntimeIdsAfterRestart':True})
            click(page,'删除智能体')
            click(d,'取消')
            expect(page.get_by_text('个人复验员离线改名',exact=True).first).to_be_visible()
            click(page,'删除智能体')
            click(d,re.compile('确认删除'))
            expect(page.get_by_text('个人复验员离线改名',exact=True)).not_to_be_visible()
            archived=sql(app,"select count(*) from agent a join public.\"user\" u on u.id=a.owner_id where u.name=:'u' and a.name='个人复验员离线改名' and a.archived_at is not null;",u=user)
            assert archived=='1'
            add('AG-11',{'cancelPreserved':True,'confirmArchived':True,'archivedDatabaseRows':1})
            click(page,'停用本机执行端')
            expect(btn(page,'启用本机执行端')).to_be_visible()
        finally:
            quit_process(pid)
            product=app/'Contents/Resources/product'
            sp.run(['/usr/bin/python3',product/'scripts/local','stop','daemon-a'],env={
                'HOME':str(Path.home()),'PATH':'/usr/bin:/bin', 'WORKBENCH_TEST_LAB':'1','WORKBENCH_RUNTIME':str(LAB),
            }, check=True)
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app',type=Path,default=DEFAULT)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    run(args.app.resolve(),args.output.resolve())
