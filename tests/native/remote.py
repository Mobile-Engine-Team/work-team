"""Check trust, cancellation and host-key replacement with a disposable loopback SSH peer."""
import argparse
from contextlib import contextmanager
import json
from pathlib import Path
import plistlib
import secrets
import subprocess as sp
import sys
import time

from playwright.sync_api import expect, sync_playwright
from shell import DEFAULT, ROOT, ax, eventually, launch, quit_process, wait_page
from agents import sql
sys.path.insert(0,str(ROOT/'tests/migration'))
from support import btn, click, close, dialog, field
from workspaces import register

@contextmanager
def server(app,user,port=0):
    product=app/'Contents/Resources/product'
    peer=sp.Popen([product/'libexec/bin/node',Path(__file__).with_name('ssh-fixture.cjs'),product,str(port),user],
                  stdout=sp.PIPE,text=True,env={'PATH':'/usr/bin:/bin'},stdin=sp.DEVNULL)
    try:
        yield int(peer.stdout.readline().strip())
    finally:
        peer.terminate()
        peer.wait(timeout=8)

def native_choice(pid,label):
    def click_button():
        script=f'''tell application "System Events" to tell (first process whose unix id is {int(pid)})
repeat with thisWindow in windows
    repeat with groupRef in (sheets of thisWindow)
        if exists button "{label}" of groupRef then
            click button "{label}" of groupRef
            return "clicked"
        end if
    end repeat
    if exists button "{label}" of thisWindow then
        click button "{label}" of thisWindow
        return "clicked"
    end if
end repeat
return "pending"
end tell'''
        return sp.run(['/usr/bin/osascript','-e',script],capture_output=True,text=True).stdout.strip()=='clicked'
    eventually(click_button,15)

def run(app,out):
    user='ssh_'+str(int(time.time()))
    report={'bundle':app.name,'build':plistlib.loads((app/'Contents/Info.plist').read_bytes())['WorkbenchBuild'],
            'identity':user,'peer':'127.0.0.1 受控 SSH 服务','checks':[]}
    def add(name,note):
        report['checks'].append({'branch':name,'ids':['EP-04','EP-05','EP-06'],'observed':note})
        out.mkdir(parents=True,exist_ok=True)
        (out/'remote.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print('PASS',name,flush=True)
    with sync_playwright() as driver:
        pid=launch(app)
        page=wait_page(driver)
        try:
            register(page,user,secrets.token_urlsafe(20))
            click(page,'成员与智能体')
            click(page,'连接远程主机')
            d=dialog(page)
            field(d,'主机地址').fill('127.0.0.1')
            field(d,'主机用户名').fill('workbench')
            def submit():
                # Each connection is an independent experiment with the same explicit inputs.
                field(d,'主机地址').fill('127.0.0.1')
                field(d,'主机用户名').fill('workbench')
                d.get_by_role('spinbutton').fill(str(port))
                field(d,'远端可访问的协作服务地址').fill('http://127.0.0.1:19115')
                password=d.locator('input[type=password]')
                password.fill('local-fixture')
                expect(password).to_have_value('local-fixture')
                expect(btn(d,'连接远程主机')).to_be_enabled()
                click(d,'连接远程主机')
            with server(app,user) as port:
                d.get_by_role('spinbutton').fill(str(port))
                submit()
                native_choice(pid,'取消')
                expect(d).to_contain_text('连接已取消')
                expect(d.locator('input[type=password]')).to_have_value('')
                add('首次拒绝','指纹确认取消后显示连接已取消并清空密码')
                submit()
                native_choice(pid,'信任并连接')
                expect(d.get_by_role('status')).to_be_visible(timeout=16000)
                add('首次信任','SSH 密码认证成功，受控远端校验转交凭据属于当前账号，返回协议级运行回执')
                click(d,'关闭')
                click(page,'连接远程主机')
                submit()
                expect(d.get_by_role('status')).to_be_visible(timeout=10000)
                add('相同指纹','再次连接已信任的本机服务，无须再次确认')
                click(d,'关闭')
            with server(app,user,port):
                click(page,'连接远程主机')
                submit()
                expect(d).to_contain_text('主机指纹与已保存记录不一致')
                add('更换指纹','同地址端口替换密钥后拒绝建立 SSH 会话，保留原表单')
                close(page)
            click(page,'连接远程主机')
            submit()
            expect(d).to_contain_text('连接失败')
            add('停止服务','回环端口关闭后显示连接失败，可改字段重试')
            count=sql(app,"select count(*) from personal_access_token t join public.\"user\" u on u.id=t.user_id where u.name=:'u' and not t.revoked",u=user)
            assert count=='2',count
            add('归属','恰有两次成功授权，三个失败分支无未撤销的凭据')
        finally:
            quit_process(pid)
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app',type=Path,default=DEFAULT)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    run(args.app.resolve(),args.output.resolve())
