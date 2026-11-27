"""Verify the shipped installation, payload boundaries, binary provenance and replay guard."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import subprocess as sp
import tempfile
from shell import DEFAULT

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream,'sha256').hexdigest()

def run(app,out):
    contents=app/'Contents'
    resource=contents/'Resources'
    install=resource/'product'
    tools=install/'libexec'
    sp.run(['/usr/bin/codesign','--verify','--strict',app],check=True)
    audit=json.loads((resource/'payload-audit.json').read_text())
    assert audit['privateStateMatches']==[] and audit['externalDependencyLinks']==[]
    files=[contents/'MacOS/Electron',tools/'bin/api',tools/'bin/multica',tools/'bin/node',tools/'pg-tools/bin/postgres']
    binaries=[{'path':str(file.relative_to(contents)),'sha256':digest(file),
               'arch':sp.check_output(['/usr/bin/lipo','-archs',file],text=True).strip()} for file in files]
    with tempfile.TemporaryDirectory(prefix='workbench-config-check-') as tmp:
        model=Path(tmp)/'model.private.json'
        model.write_text(json.dumps({'baseUrl':'https://example.invalid','model':'test','apiKey':'test-placeholder'}))
        model.chmod(0o600)
        guard=sp.run(['/usr/bin/python3',install/'scripts/local','start','a','--fixture'],
                     env={'WORKBENCH_RUNTIME':tmp,'HOME':str(Path.home()),'PATH':'/usr/bin:/bin'},
                     capture_output=True,text=True)
        assert guard.returncode and '本地回放需要回环模型' in guard.stderr,guard.returncode
        assert not list(Path(tmp).glob('*.pid.json'))
    out.mkdir(parents=True,exist_ok=True)
    signature=sp.run(['/usr/bin/codesign','-d','-vvv',app],capture_output=True,text=True,check=True)
    cdhash=next(line.split('=',1)[1] for line in signature.stderr.splitlines() if line.startswith('CDHash='))
    data={'bundle':app.name, 'codeDirectoryHash':cdhash,
          'nodeVersion':sp.check_output([tools/'bin/node','--version'],text=True).strip(),
          'dshVersion':json.loads((tools/'dsh-cli/lib/node_modules/@deepseek-ai/dsh/package.json').read_text())['version'], 'build':plistlib.loads((contents/'Info.plist').read_bytes())['WorkbenchBuild'],
          'signature':'codesign --verify --strict passed','payload':audit,'binaries':binaries,
          'fixtureGuard':'本地回放拒绝非回环模型配置，未启动服务'}
    (out/'packaging.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    print(out/'packaging.json')
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app',type=Path,default=DEFAULT)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    run(args.app.resolve(),args.output.resolve())
