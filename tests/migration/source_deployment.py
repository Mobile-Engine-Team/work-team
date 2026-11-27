"""Replay the browser deployment with a clean runtime and a loopback model."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import tempfile
import threading
import time
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright

from support import btn, click, close, combo, dialog, field
from workspaces import register

ROOT = Path(__file__).resolve().parents[2]


def run(runtime, results):
    report = {
        'macOS': subprocess.check_output(['sw_vers', '-productVersion'], text=True).strip(),
        'machine': os.uname().machine,
        'checks': [],
    }

    def record(check):
        report['checks'].append(check)
        results.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n')
        print(check, flush=True)

    class Model(BaseHTTPRequestHandler):
        def do_POST(self):
            payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            if payload.get('model') != 'deepseek-flash':
                self.send_error(400)
                return
            prompt = json.dumps(payload['messages'], ensure_ascii=False)
            if 'MW_CONNECTION_OK' in prompt:
                answer = 'MW_CONNECTION_OK'
            elif '请用一句话确认本机问答' in prompt:
                # The workbench validates structured answer events before publishing a surface.
                answer = '\n'.join(json.dumps(event, ensure_ascii=False) for event in [
                    {'type': 'plan', 'plan': {
                        'title': '本机问答', 'intent': '确认本机问答', 'layout': 'stack',
                        'sections': [{'id': 'reply', 'role': 'primary', 'surface': 'plain'}],
                    }},
                    {'type': 'section', 'section': {
                        'id': 'reply', 'dataRefs': [], 'facts': [], 'surface': {
                            'catalogId': 'https://mobilework.local/catalog/answer/v1',
                            'components': [{'id': 'root', 'component': 'Prose', 'body': '工作台已收到本地模型回复'}],
                        },
                    }},
                    {'type': 'final', 'sections': ['reply'], 'limitations': [], 'followUps': []},
                ])
            else:
                answer = '本机 Pi 已完成合成任务'
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.end_headers()
            for delta, finish in [
                ({'role': 'assistant', 'content': answer}, None), ({}, 'stop'),
            ]:
                chunk = {
                    'id': 'local-test', 'object': 'chat.completion.chunk', 'created': 1,
                    'model': 'deepseek-flash',
                    'choices': [{'index': 0, 'delta': delta, 'finish_reason': finish}],
                }
                self.wfile.write(('data: ' + json.dumps(chunk) + '\n\n').encode())
            self.wfile.write(b'data: [DONE]\n\n')

        def log_message(self, *_):
            pass

    env = os.environ | {'WORKBENCH_RUNTIME': str(runtime), 'WORKBENCH_TEST_LAB': '1'}

    def deploy(*args):
        subprocess.run([ROOT/'scripts/deploy', *args], cwd=ROOT, env=env, check=True)

    with ThreadingHTTPServer(('127.0.0.1', 0), Model) as server:
        listener = threading.Thread(target=server.serve_forever, daemon=True)
        listener.start()
        try:
            deploy('setup')
            record('空运行目录完成公开依赖安装和 Multica 编译')
            config = runtime/'model.private.json'
            config.write_text(json.dumps({'baseUrl': f'http://127.0.0.1:{server.server_port}',
                                          'model': 'deepseek-flash', 'apiKey': 'synthetic-local-key'}))
            config.chmod(0o600)
            deploy('start', 'a')
            deploy('start', 'b')
            with urlopen('http://127.0.0.1:19115/health', timeout=5) as health:
                assert health.status == 200
            record('PostgreSQL、Multica API 和两个 DSH Host 正常启动')
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(channel='chrome')
                context = browser.new_context(viewport={'width': 1180, 'height': 810})
                a, b = [context.new_page() for _ in range(2)]
                user_a, user_b = ['source_' + secrets.token_hex(4) for _ in range(2)]
                password = secrets.token_urlsafe(20)
                for page, profile, account in [(a, 'a', user_a), (b, 'b', user_b)]:
                    page.set_default_timeout(20_000)
                    page.goto((runtime/profile/'entry.private').read_text().strip())
                    register(page, account, password)
                click(a, '新建工作区')
                field(dialog(a), '名称').fill('源码部署验证')
                field(dialog(a), '工作区地址').fill('source-check')
                click(dialog(a), '创建')
                click(a, '成员与智能体')
                click(a, '邀请成员')
                dialog(a).get_by_role('textbox').fill(user_b)
                click(dialog(a), '保存')
                click(b.locator('.team-invite-toast'), re.compile('接受'))
                expect(b.get_by_role('combobox', name='工作区')).to_contain_text('源码部署验证')
                record('双浏览器账号注册并通过邀请进入同一团队')

                click(a, '新对话')
                composer = a.locator('.wb-composer textarea')
                composer.fill('请用一句话确认本机问答')
                composer.press('Enter')
                expect(a.get_by_text('工作台已收到本地模型回复', exact=True)).to_be_visible(timeout=45_000)
                record('工作台通过服务端使用回环模型生成正文')

                click(a, '成员与智能体')
                click(a, '启用本机执行端')
                expect(a.get_by_text('Pi', exact=True)).to_be_visible(timeout=45_000)
                click(a, '新建智能体')
                field(dialog(a), '名称').fill('源码部署 Pi')
                combo(dialog(a), '选择执行端', re.compile(r'^Pi\b'))
                dialog(a).get_by_role('checkbox').check()
                click(dialog(a), '保存')
                click(a, '测试模型调用')
                click(dialog(a), '测试模型调用')
                expect(dialog(a).get_by_text('模型调用通过', exact=True)).to_be_visible(timeout=65_000)
                close(a)
                record('正常模式执行端发现真实 Pi CLI，使用回环模型通过模型探针')

                click(b, '任务')
                click(b, '新建任务')
                field(dialog(b), '任务标题').fill('源码部署回执')
                combo(dialog(b), '负责人', re.compile('源码部署 Pi'))
                click(dialog(b), '创建任务')
                expect(btn(b, '返回任务列表')).to_be_visible()
                combo(b, '状态', '进行中')
                click(dialog(b), '确认并开始')
                postgres = subprocess.check_output(['brew', '--prefix', 'postgresql@18'], text=True).strip()
                command = [
                    Path(postgres)/'bin/psql', '-XqAt', '-h', '127.0.0.1', '-p', '54459',
                    '-U', 'workbench', '-d', 'workbench',
                    '-c', """select q.status from agent_task_queue q join issue i on i.id=q.issue_id
                             where i.title='源码部署回执' order by q.created_at desc limit 1""",
                ]
                deadline = time.monotonic() + 100
                while time.monotonic() < deadline:
                    status = subprocess.check_output(command, text=True, env=env | {
                        'PGPASSWORD': (runtime/'db-password').read_text(),
                    }).strip()
                    if status == 'completed':
                        break
                    assert status not in ('failed', 'cancelled'), status
                    time.sleep(1)
                else:
                    raise AssertionError('Pi 执行回执未完成')
                record('B 分派给 A 共享的 Pi 智能体，实际任务队列记录完成')
                browser.close()
        finally:
            server.shutdown()
            listener.join()
            deploy('stop')
    record('本轮服务和执行端已定向停止')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='workbench-local-deploy-') as folder:
        run(Path(folder), args.output)
