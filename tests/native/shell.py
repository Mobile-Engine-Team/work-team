"""Replay macOS menu, close, reopen and cold-launch behavior on the packaged product."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import subprocess as sp
import time
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / '.local/v2-runtime/desktop/Team Workbench.app'
PORT = 19885
BASE = ROOT / 'docs/demo-v2-baseline/evidence'
LAB = ROOT / '.local/v2-runtime/isolated-replay'

def eventually(action, seconds=30):
    stop = time.monotonic() + seconds
    while time.monotonic() < stop:
        try:
            value = action()
            if value:
                return value
        except (OSError, ValueError, IndexError):
            pass
        time.sleep(.15)
    raise TimeoutError('Timed out waiting for ' + action.__name__)

def launch(app,profile='a',port=PORT):
    sp.run(['/usr/bin/open','-n','-a',app,'--args','--workbench-isolated-replay','--workbench-fixture',
            '--workbench-profile='+profile,'--remote-debugging-address=127.0.0.1', '--remote-debugging-port='+str(port)],check=True)
    def ready():
        data = json.load(urlopen(f'http://127.0.0.1:{port}/json/list', timeout=1))
        return any(t['type']=='page' and t['url'].startswith('http://127.0.0.1:'+str(19116 if profile=='a' else 19117)+'/') for t in data)
    eventually(ready,130)
    rows = sp.check_output(['/bin/ps','-ax','-o','pid=,comm='],text=True).splitlines()
    exe = str(app/'Contents/MacOS/Electron')
    for row in rows:
        pid, command = row.strip().split(maxsplit=1)
        if command == exe:
            args = sp.check_output(['/bin/ps','-p',pid,'-o','args='],text=True)
            if '--workbench-isolated-replay' in args and ('--workbench-profile=b' in args)==(profile=='b'):
                return int(pid)
    raise RuntimeError('Port answered but isolated app main process did not match the bundle')

def ax(pid,statement):
    body = f'tell application "System Events" to tell (first process whose unix id is {int(pid)})\n{statement}\nend tell'
    return sp.check_output(['/usr/bin/osascript','-e',body],text=True).strip()

def press(pid, menu, item):
    return ax(pid,f'perform action "AXPress" of menu item "{item}" of menu 1 of menu bar item "{menu}" of menu bar 1')

def quit_process(pid):
    press(pid,'团队工作台','退出 MobileWork_公众版_DEV')
    eventually(lambda: sp.run(['/bin/ps','-p',str(pid)], stdout=sp.DEVNULL).returncode != 0)

def wait_page(driver,port=PORT):
    browser=driver.chromium.connect_over_cdp(f'http://127.0.0.1:{port}')
    page=browser.contexts[0].pages[0]
    expect(page.get_by_role('textbox',name='账号',exact=True)).to_be_visible(timeout=35000)
    return page

def run(app,output):
    output.mkdir(parents=True,exist_ok=True)
    baseline=json.loads((BASE/'native-menu.json').read_text())['菜单']
    result={'bundle':app.name, 'build':plistlib.loads((app/'Contents/Info.plist').read_bytes())['WorkbenchBuild'],
            'macOS':sp.check_output(['sw_vers','-productVersion'],text=True).strip(), 'checks':[], 'menus':[]}
    def save(ids,detail):
        result['checks'].append({'ids':ids,'observed':detail})
        (output/'shell.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    with sync_playwright() as driver:
        pid=launch(app)
        page=wait_page(driver)
        size=page.evaluate('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,language:navigator.language})')
        assert [size['width'],size['height'],size['dpr']]==[1180,810,2], size
        save(['OS-01','OS-02','D-01'],{'url':page.url.split('?')[0], 'viewport':size})
        for group in baseline:
            name='团队工作台' if group is baseline[0] else group['menu']
            names=ax(pid,f'get name of menu items of menu 1 of menu bar item "{name}" of menu bar 1').split(', ')
            old=[item for item in group['items'] if item]
            actual=[item for item in names if item!='missing value']
            assert actual == old,(name,actual,old)
            result['menus'].append({'menu':name,'items':actual})
        save(['OS-03','OS-05','OS-06','OS-07'],'五个应用菜单逐项与冻结 AX 枚举匹配')
        press(pid,'团队工作台','关于 MobileWork_公众版_DEV')
        eventually(lambda: int(ax(pid,'get count of windows'))>=2)
        about=ax(pid,'get value of every static text of window 1')
        assert 'MobileWork_公众版_DEV' in about
        ax(pid,'perform action "AXPress" of (first button of window 1 whose subrole is "AXCloseButton")')
        eventually(lambda: ax(pid,'get count of windows')=='1')
        save(['MAC-101'],{'nativeAboutPanelText':about})
        press(pid,'团队工作台','隐藏 MobileWork_公众版_DEV')
        eventually(lambda: ax(pid,'get visible')=='false')
        assert launch(app)==pid
        eventually(lambda: ax(pid,'get visible')=='true')
        save(['MAC-104'],{'hidden':True,'sameAppReactivated':True})
        account=page.get_by_role('textbox',name='账号',exact=True)
        account.fill('shell_check')
        press(pid,'团队工作台','设置…')
        press(pid,'显示','切换侧边栏')
        assert account.input_value()=='shell_check'
        save(['MAC-102','MAC-401'],{'route':page.evaluate('location.hash'),'dialogs':page.get_by_role('dialog').count()})
        # Responder-chain edits operate on the focused account field; no pasteboard contents are read.
        account.focus()
        press(pid,'编辑','全选')
        press(pid,'编辑','删除')
        expect(account).to_have_value('')
        press(pid,'编辑','撤销')
        expect(account).to_have_value('shell_check')
        press(pid,'编辑','重做')
        expect(account).to_have_value('')
        save(['MAC-301','MAC-302','MAC-307'],{'delete':'','undo':'shell_check','redo':''})
        account.fill('shell_check')
        press(pid,'窗口','最小化')
        eventually(lambda: ax(pid,'get value of attribute "AXMinimized" of window 1')=='true')
        assert launch(app)==pid
        eventually(lambda: ax(pid,'get value of attribute "AXMinimized" of window 1')=='false')
        save(['MAC-501','OS-07'],{'restored':True,'samePid':True})
        ax(pid,'perform action "AXPress" of (first button of window 1 whose subrole is "AXCloseButton")')
        eventually(lambda: ax(pid,'get count of windows')=='0')
        # A second launch of the same profile is routed to the surviving process.
        pid2=launch(app)
        assert pid2==pid
        eventually(lambda: ax(pid,'get count of windows')=='1')
        assert account.input_value()=='shell_check'
        save(['OS-04','STATE-01'],{'redButton':'hidden','samePid':True,'sameInput':'shell_check'})
        press(pid,'文件','关闭窗口')
        eventually(lambda: ax(pid,'get count of windows')=='0')
        assert launch(app)==pid
        eventually(lambda: ax(pid,'get count of windows')=='1')
        assert account.input_value()=='shell_check'
        save(['MAC-201'],{'menuClose':'hidden','samePid':True,'sameInput':'shell_check'})
        press(pid,'显示','重新加载')
        expect(account).to_have_value('')
        account.fill('force_reload_check')
        press(pid,'显示','强制重新加载')
        expect(account).to_have_value('')
        save(['MAC-403'],{'hashAfterForceReload':page.evaluate('location.hash')})
        size1=page.evaluate('[innerWidth,innerHeight,devicePixelRatio]')
        press(pid,'显示','放大')
        eventually(lambda: page.evaluate('innerWidth')<size1[0])
        zoom=page.evaluate('[innerWidth,innerHeight,devicePixelRatio]')
        press(pid,'显示','实际大小')
        eventually(lambda: page.evaluate('innerWidth')==size1[0])
        save(['MAC-402','MAC-405','MAC-406','STATE-09'],{'before':size1,'larger':zoom,'restored':page.evaluate('[innerWidth,innerHeight,devicePixelRatio]')})
        press(pid,'显示','缩小')
        eventually(lambda: page.evaluate('innerWidth')>size1[0])
        smaller=page.evaluate('[innerWidth,innerHeight,devicePixelRatio]')
        press(pid,'显示','实际大小')
        eventually(lambda: page.evaluate('innerWidth')==size1[0])
        save(['MAC-407'],{'smaller':smaller,'restored':page.evaluate('[innerWidth,innerHeight,devicePixelRatio]')})
        quit_process(pid)
        new_pid=launch(app)
        assert new_pid!=pid
        page=wait_page(driver)
        assert page.locator('input[type=password]').input_value()==''
        assert page.get_by_role('textbox',name='账号',exact=True).input_value()==''
        file=output/'32-cold-start.png'
        page.screenshot(path=file,animations='disabled')
        save(['MAC-107','STATE-01'],{'newPid':True,'emptyAccountAndPassword':True,
                                     'image':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
        quit_process(new_pid)
    print(output/'shell.json')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app',type=Path,default=DEFAULT)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    run(args.app.resolve(),args.output.resolve())
