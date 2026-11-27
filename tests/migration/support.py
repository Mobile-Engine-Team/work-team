"""Small UI and persistence helpers for the product's two-client replay."""
from datetime import datetime
from hashlib import sha256
import json
import os
import plistlib
from pathlib import Path
import re
import subprocess
import time
import uuid
from zoneinfo import ZoneInfo

from playwright.sync_api import expect

ROOT = Path(__file__).resolve().parents[2]
BASELINE = ROOT / 'docs/demo-v2-baseline'
RUNTIME = ROOT / '.local/v2-runtime'
PG = Path(os.environ.get('WORKBENCH_PG_BIN', ROOT.parents[1] / '.local/mvp-single-mac-2026-11-05/state/pg-tools/bin'))

def stamp():
    return datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(timespec='seconds')

def sql(statement, **variables):
    env = {**os.environ, 'PGPASSWORD': (RUNTIME / 'db-password').read_text().strip(),
           'PGCONNECT_TIMEOUT': '5'}
    cmd = [PG / 'psql', '-XqAt', '-h', '127.0.0.1', '-p', '54359', '-U', 'workbench',
           '-d', 'workbench', '-v', 'ON_ERROR_STOP=1']
    for key, value in variables.items():
        cmd += ['-v', f'{key}={value}']
    return subprocess.check_output(cmd, input=statement, env=env, text=True).strip()

def btn(p, name):
    return p.get_by_role('button', name=name, exact=isinstance(name, str)).last

def click(p, name):
    btn(p, name).click()

def combo(p, name, item):
    p.get_by_role('combobox', name=name, exact=True).click()
    page = getattr(p, 'page', p)  # listbox is portaled next to the dialog
    page.get_by_role('option', name=item, exact=isinstance(item, str)).first.click()

def field(p, name):
    return p.get_by_role('textbox', name=name, exact=True)

def space(p, name):
    combo(p, '工作区', re.compile(re.escape(name)))
    expect(p.get_by_role('combobox', name='工作区')).to_contain_text(name)

def dialog(p):
    return p.get_by_role('dialog').last

def close(p):
    p.keyboard.press('Escape')
    expect(dialog(p)).not_to_be_visible()

def choose_file(p, name, content):
    p.locator('input[type=file]').set_input_files({'name': name, 'mimeType': 'text/plain', 'buffer': content})

def issue(p, title):
    click(p, '任务')
    p.get_by_role('button', name=re.compile(re.escape(title))).first.click()
    expect(btn(p, '返回任务列表')).to_be_visible()

def login(p, name, password):
    field(p, '账号').fill(name)
    p.locator('input[type=password]').fill(password)
    p.locator('form button').click()
    expect(p.get_by_role('combobox', name='工作区')).to_contain_text('个人工作区')

def dump(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)

def build_manifest(mode):
    bundle = RUNTIME/'desktop/Team Workbench.app'
    source = bundle/'Contents/Resources/product' if mode=='native' else ROOT
    files = sorted(path for path in (source / 'packages').glob('*/dist/**/*') if path.is_file())
    for directory in ('multica-host', 'execution-bridge', 'product-bundle'):
        files.extend(sorted(p for p in (source/'packages'/directory).iterdir() if p.is_file()))
    hashes = {str(p.relative_to(source)): sha256(p.read_bytes()).hexdigest() for p in files}
    info = plistlib.loads((bundle/'Contents/Info.plist').read_bytes()) if bundle.exists() else {}
    return {'appBundle':str(bundle), 'macBuild':info.get('WorkbenchBuild'), 'git': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'productFiles': hashes, 'assemblySha256': sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()}

class Evidence:
    def __init__(self, out, mode, users):
        self.out = out
        self.out.mkdir(exist_ok=True, parents=True)
        self.data = {'start': stamp(), 'mode': mode, 'users': users, 'build': build_manifest(mode),
                     'status': 'running', 'checks': [], 'images': {}, 'business': {}}

    def save(self):
        dump(self.out/'results.json', self.data)

    def record(self, p, ids, condition, observation, image=None, role=None):
        entry = dict(ids=ids.split(), condition=condition, observation=observation,
                     role=role or p.test_role, status='pass')
        if image:
            image = next((BASELINE/'evidence').glob(image+'-*.png')).name
            target = self.out/image
            p.evaluate('document.fonts.ready')
            p.screenshot(path=str(target), animations='disabled')
            viewport = p.evaluate('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,language:navigator.language})')
            self.data['images'][image] = {'role':entry['role'], 'viewport':viewport,
                'sha256':sha256(target.read_bytes()).hexdigest(), 'route':p.evaluate('location.hash')}
            entry['image'] = image
        self.data['checks'].append(entry)
        self.save()
        print('PASS', '/'.join(entry['ids']), condition, flush=True)

    def business(self, key, value):
        self.data['business'][key] = value
        self.save()

def wait_sql(query, expected, **keys):
    stop = time.monotonic()+12
    while time.monotonic()<stop:
        actual=sql(query, **keys)
        if actual==expected:
            return actual
        time.sleep(.15)
    raise AssertionError(f'expected DB {expected!r}, observed {actual!r}')

def seed_history(slug, owner):
    rows=sql('''select w.id,u.id,i.id from workspace w join member m on m.workspace_id=w.id
        join public."user" u on u.id=m.user_id join issue i on i.workspace_id=w.id
        where w.slug=:'slug' and u.name=:'owner' and m.role='owner' and i.title='核对交接清单';''',
        slug=slug, owner=owner).splitlines()
    assert len(rows)==1
    wid, uid, iid=[str(uuid.UUID(v)) for v in rows[0].split('|')]
    item=json.loads((BASELINE/'replay/answers.json').read_text().replace('{issueId}', iid))[0]
    sql('''begin;
        insert into workbench_conversation(id,workspace_id,owner_id,title)
        values (:'cid',:'wid',:'uid',:'title');
        insert into workbench_message(id,conversation_id,workspace_id,owner_id,prompt,status,result)
        values (:'mid',:'cid',:'wid',:'uid',:'prompt','completed',:'result'::jsonb);
        commit;''',cid=str(uuid.uuid4()),mid=str(uuid.uuid4()),wid=wid,uid=uid,
        title=item['title'],prompt=item['prompt'],result=json.dumps(item['result'],ensure_ascii=False))
