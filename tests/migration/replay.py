"""Replay the two-client synthetic journeys against the assembled product.

Native mode opens two instances of the same application through LaunchServices.
Only test profiles started with the requested loopback inspector can be closed.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import time
from types import SimpleNamespace
from urllib.error import URLError
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright
from support import ROOT, RUNTIME, Evidence, btn, click, dump, field, stamp
from task_edges import database, anchors, drafting, lost_response
from details import details
from edges import secondary, pending, recovery, role_sample
from tasks import online, dispatch, identity, squad, tasks
from workspaces import accounts, agents, forms, invite, workspace

HOST_PORTS={'a':19016,'b':19017}
DEBUG_PORTS={'a':19883,'b':19884}
STAGES=[accounts,workspace,forms,invite,agents,tasks,squad,identity,dispatch,online,pending,recovery,role_sample,secondary,anchors,lost_response,drafting,details,database]

def local(*args):
    subprocess.run([ROOT/'scripts/local',*args],cwd=ROOT,check=True)

def listener(port):
    result=subprocess.run(['/usr/sbin/lsof','-nP','-t',f'-iTCP:{port}','-sTCP:LISTEN'],text=True,capture_output=True)
    return [int(x) for x in set(result.stdout.split())]

def stop_window(name):
    port=DEBUG_PORTS[name]
    pids=listener(port)
    if not pids:
        return
    if len(pids)!=1:
        raise RuntimeError(f'Multiple processes at the requested test port {port}')
    pid=pids[0]
    cmd=subprocess.check_output(['ps','-p',str(pid),'-o','args='],text=True)
    if f'--workbench-profile={name}' not in cmd or '--workbench-fixture' not in cmd or f'--remote-debugging-port={port}' not in cmd:
        raise RuntimeError(f'Port {port} is not the fixture window for {name}')
    os.kill(pid,signal.SIGTERM)
    for _ in range(80):
        if not listener(port):
            return
        time.sleep(.1)
    raise RuntimeError(f'Fixture window {name} did not quit')

def native_page(pw,name):
    port=DEBUG_PORTS[name]
    if not listener(port):
        local('open',name,'--fixture','--inspect-port',str(port))
    deadline=time.monotonic()+75
    while time.monotonic()<deadline:
        try:
            with urlopen(f'http://127.0.0.1:{port}/json/list',timeout=1) as response:
                targets=json.load(response)
            if any(f'127.0.0.1:{HOST_PORTS[name]}/' in t.get('url','') for t in targets):
                break
        except (URLError,TimeoutError,ConnectionError):
            pass
        time.sleep(.3)
    else:
        raise RuntimeError(f'{name} has no product renderer on inspector {port}')
    br=pw.chromium.connect_over_cdp(f'http://127.0.0.1:{port}')
    p=next(p for c in br.contexts for p in c.pages if p.url.startswith(f'http://127.0.0.1:{HOST_PORTS[name]}/'))
    p.test_role=name.upper()
    p.set_default_timeout(15000)
    p.on('console', lambda msg: print('RENDER ERROR', str(msg.text).split('\n')[0][:240], flush=True)
         if msg.type=='error' and ('TypeError' in msg.text or 'slot entry crashed' in msg.text) else None)
    p.wait_for_selector('input[type=password], [role=combobox]',timeout=25000)
    return p

def synthetic_login_page(p):
    if btn(p,'退出账号').count():
        click(p,'退出账号')
    expect(field(p,'账号')).to_be_visible()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser',action='store_true',help='run isolated Chrome contexts at the same Host URLs')
    parser.add_argument('--output',type=Path,help='evidence directory (defaults to a new local replay directory)')
    parser.add_argument('--keep-windows',action='store_true',help='keep fixture windows open after a successful run')
    parser.add_argument('--resume',type=Path,help='existing private run directory to continue after fixing a failed step')
    parser.add_argument('--stages',nargs='+',choices=[f.__name__ for f in STAGES])
    args=parser.parse_args()
    mode='browser' if args.browser else 'native'
    suffix=secrets.token_hex(4)
    private=args.resume or ROOT/'.local/migration-replays'/suffix
    private.mkdir(parents=True,exist_ok=True)
    config_file=private/'accounts.private.json'
    if args.resume:
        cfg=json.loads(config_file.read_text())
    else:
        cfg={'ua':'checka_'+suffix,'ub':'checkb_'+suffix,'slug':'verify-'+suffix,'password':secrets.token_urlsafe(18),
             'output':str(args.output or private/'evidence')}
        dump(config_file,cfg)
        config_file.chmod(0o600)
    output=Path(cfg['output'])
    previous=json.loads((output/'results.json').read_text()) if args.resume else None
    ev=Evidence(output,mode,{'A':cfg['ua'],'B':cfg['ub'],'team':cfg['slug']})
    if previous:
        if previous['build']['assemblySha256'] != ev.data['build']['assemblySha256']:
            raise RuntimeError('Product build changed. Start a new replay.')
        ev.data=previous
        ev.data['status']='running'
    ev.save()
    print('private run',private,'evidence',output,flush=True)
    stages=[f for f in STAGES if not args.stages or f.__name__ in args.stages]
    with sync_playwright() as pw:
        r=SimpleNamespace(**cfg,ev=ev,private=private,mode=mode)
        try:
            if args.browser:
                local('start','a','--fixture')
                local('start','b','--fixture')
                br=pw.chromium.launch(channel='chrome')
                for name in ('a','b'):
                    ctx=br.new_context(viewport={'width':1180,'height':810},device_scale_factor=2,
                        locale='en-US',timezone_id='Asia/Shanghai',color_scheme='light',accept_downloads=True)
                    p=ctx.new_page()
                    p.goto((RUNTIME/name/'entry.private').read_text().strip(),wait_until='domcontentloaded')
                    p.test_role=name.upper()
                    p.set_default_timeout(15000)
                    setattr(r,name,p)
            else:
                r.a=native_page(pw,'a')
                r.b=native_page(pw,'b')
                def reopen_b():
                    stop_window('b')
                    r.b=native_page(pw,'b')
                    return r.b
                r.reopen_b=reopen_b
            if mode=='native':
                bundle=RUNTIME/'desktop/Team Workbench.app'
                product=bundle/'Contents/Resources/product'
                profiles={}
                for name in ('a','b'):
                    target=(RUNTIME/name/'dsh/profiles/workbench/node_modules/@team-workbench/product-bundle').resolve()
                    if target!=(product/'packages/product-bundle').resolve():
                        raise RuntimeError(f'{name} is connected to a development Host. Restart both Hosts from the .app.')
                    profiles[name]=str(target.relative_to(bundle))
                binaries={}
                for name in ('api','db'):
                    pid=json.loads((RUNTIME/(name+'.pid.json')).read_text())[0]
                    executable=Path(subprocess.check_output(['ps','-p',str(pid),'-o','comm='],text=True).strip())
                    binaries[name]=str(executable.relative_to(bundle))
                ev.business('nativeAssembly',{'profileTargets':profiles,'services':binaries})
            if not args.resume:
                for p in (r.a,r.b):
                    synthetic_login_page(p)
                    geometry=p.evaluate('([innerWidth,innerHeight,devicePixelRatio])')
                    if geometry!=[1180,810,2]:
                        raise RuntimeError(f'{mode} {p.test_role} viewport {geometry}, expected 1180×810 CSS at DPR 2')
            ev.data['requestedSteps']=[step.__name__ for step in stages]
            for step in stages:
                print('STEP',step.__name__,flush=True)
                ev.data['activeStep']=step.__name__
                ev.save()
                step(r)
                completed=ev.data.setdefault('completedSteps',[])
                if step.__name__ not in completed:
                    completed.append(step.__name__)
                ev.save()
            ev.data['status']='pass'
            ev.data['finished']=stamp()
            ev.save()
            if mode=='native' and not args.keep_windows:
                for name in ('a','b'):
                    stop_window(name)
        except Exception as error:
            ev.data['status']='failed'
            ev.data['failedAt']=stamp()
            ev.data['errorType']=type(error).__name__
            ev.save()
            for name in ('a','b'):
                page=getattr(r,name,None)
                if page and not page.is_closed():
                    # Full diagnostics stay local; neither DOM trees nor screenshots of a password form enter evidence.
                    try:
                        page.screenshot(path=str(private/(name+'-failure.png')),timeout=3000)
                        (private/(name+'-tree.txt')).write_text(page.locator('body').aria_snapshot(timeout=3000))
                    except Exception:
                        pass
            raise

if __name__=='__main__':
    os.umask(0o077)
    main()
