"""Open the delivered package without arguments and check its visible native login surface."""
import argparse
import json
from pathlib import Path
import plistlib
import subprocess as sp
import tempfile
from shell import DEFAULT, eventually, quit_process


def owned_pid(app):
    executable=str(app/'Contents/MacOS/Electron')
    for row in sp.check_output(['/bin/ps','-ax','-o','pid=,comm='],text=True).splitlines():
        pid,command=row.strip().split(maxsplit=1)
        if command==executable:
            args=sp.check_output(['/bin/ps','-p',pid,'-o','args='],text=True)
            # Explicit B and the isolated replay window can remain open during this check.
            if '--workbench-profile=b' not in args and '--workbench-isolated-replay' not in args:
                return int(pid)


def run(app,out,keep):
    if owned_pid(app):
        raise SystemExit('请从产品 A 的应用菜单退出，再复验 Finder 冷启动。')
    sp.run(['/usr/bin/open',app],check=True)
    pid=eventually(lambda:owned_pid(app))
    temp = tempfile.TemporaryDirectory(prefix='workbench-ax-')
    reader = Path(temp.name)/'read-login'
    sp.run(['/usr/bin/xcrun','swiftc',Path(__file__).with_name('login-ax.swift'),'-o',reader],check=True)
    def visible():
        result=sp.run([reader,str(pid)],capture_output=True,text=True)
        labels=result.stdout.splitlines()
        return labels if set(labels)>={'账号','密码','没有账号？注册账号'} else False
    try:
        labels=eventually(visible,90)
        resource=app/'Contents/Resources'
        runtime=Path(json.loads((resource/'installation.json').read_text())['runtime'])
        bundled={}
        for service,entry in [('a','scripts/local'),('api','libexec/bin/api'),('db','libexec/pg-tools/bin/postgres')]:
            owner=json.loads((runtime/(service+'.pid.json')).read_text())[0]
            command=sp.check_output(['/bin/ps','-p',str(owner),'-o','command='],text=True)
            expected=str(resource/'product'/entry)
            assert expected in command, f'{service} is not running the shipped executable'
            bundled[service]={'pid':owner,'productEntry':entry}
        data={'ids':['OS-01','OS-02','D-01'],'application':app.name,'launch':'/usr/bin/open <bundle>',
              'build':plistlib.loads((app/'Contents/Info.plist').read_bytes())['WorkbenchBuild'],
              'process':pid,'accessibilityLabels':labels,'additionalArguments':[], 'bundledServices':bundled}
        out.mkdir(parents=True,exist_ok=True)
        (out/'finder.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
        print(out/'finder.json')
    finally:
        temp.cleanup()
        if not keep:quit_process(pid)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app',type=Path,default=DEFAULT)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--keep-open',action='store_true')
    args=parser.parse_args()
    run(args.app.resolve(),args.output.resolve(),args.keep_open)
