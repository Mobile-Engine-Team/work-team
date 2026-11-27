"""Index frozen desktop controls against this checkout's assembled renderer sources."""
from collections import Counter
from difflib import SequenceMatcher
from functools import lru_cache
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'docs/demo-v2-baseline'
OUT = ROOT / 'docs/migration-evidence/controls.md'
VIEWS = ROOT / 'packages/ui-workspace-shell/views'
FROZEN = Path(os.environ.get('WORKBENCH_V2_SRC', ROOT.parents[1] / '.local/demo-v2/src/mobile-work-client'))


def link(path, line=None):
    return os.path.relpath(path, OUT.parent) + (f'#L{line}' if line else '')


@lru_cache(maxsize=None)
def unchanged_lines(old, new):
    a = old.read_text().splitlines()
    b = new.read_text().splitlines()
    matcher = SequenceMatcher(None, a, b, autojunk=False)
    return {i + offset + 1: j + offset + 1
            for i, j, count in matcher.get_matching_blocks() for offset in range(count)}


def find_line(file, needle):
    return next(i for i, row in enumerate(file.read_text().splitlines(), 1) if needle in row)


def target(old, line):
    name = old.name
    if name == 'personal.tsx':
        return None, None, '冻结三条桌面路由没有此个人任务页面；见 X-02。'
    if name == 'window-caption-controls.tsx':
        return None, None, 'Windows 自绘按钮。本次 macOS 使用原生窗口。'
    file = VIEWS / old.parent.name / name
    if name == 'team-page.tsx' and 241 <= line <= 392:
        file = ROOT / 'packages/ui-inbox/view.tsx'
    if name == 'team-page.tsx' and line == 234:
        file = ROOT / 'packages/ui-tasks/client.jsx'
        return file, find_line(file, "text('newTask')"), '入口由任务页插件注册。'
    if name == 'remote-host.tsx' and line == 32:
        return file, find_line(file, 'label={text("remoteServer")}'), '初次地址由当前 Host 提供，用户可编辑。'
    mapped = unchanged_lines(old, file).get(line)
    if mapped is not None:
        return file, mapped, ''
    raise RuntimeError(f'Check moved control before publishing: {old.name}:{line}')


def main():
    rows = []
    counts = Counter()
    ids = set()
    conditions = {}
    for chapter in sorted(BASE.glob('[0-9][0-9]-*.md')):
        for row in chapter.read_text().splitlines():
            match = re.match(r'\| <a id="[^"]+"></a>([A-Z]+-\d+) \| ([^|]+)', row)
            if match:
                conditions[match[1]] = match[2].strip()
    old = None
    for row in (BASE/'controls.md').read_text().splitlines():
        if row.startswith('## '):
            rows.extend(['', row, '', '| 冻结行／控件 | 当前实现 | 基线条件和分支 |', '|---|---|---|'])
        if match := re.match(r'\[冻结源码\]\((.+)\)', row):
            suffix = match[1].split('mobile-work-client/', 1)[1]
            old = FROZEN / suffix
        if not (match := re.match(r'\| (\d+) \| ([^|]+) \| (.+?) \|$', row)):
            continue
        line, label, references = int(match[1]), match[2], match[3]
        file, actual, note = target(old, line)
        checks = re.findall(r'\[([A-Z]+-\d+)\]\(([^)]+)\)', references)
        ids.update(check for check, _ in checks)
        counts['lines'] += 1
        counts['located' if file else 'conditional'] += 1
        product = f'[{file.relative_to(ROOT / "packages")}:{actual}]({link(file,actual)})' if file else '—'
        if old.name == 'tasks.tsx' and any(check == 'X-02' for check, _ in checks):
            note = '兼容条件要求历史 source、suppliedDraft、quickResult 或已关联的个人任务。'
        if old.name == 'team-page.tsx' and line == 184:
            note = 'showInvitationNotifications=false 才显示此卡；冻结桌面与本产品均启用账号邀请提示。'
        if old.name == 'team-page.tsx' and line == 147:
            note = '须已登录且工作区列表长度为 0；新账号通常已自动建立个人区。'
        if old.name == 'team-page.tsx' and line == 158:
            note = '须 URL 的 slug 无法匹配，同时至少有一个工作区。'
        if old.name == 'markdown.tsx' and line == 25:
            note = '传给系统应用的外部地址只核对分派边界。'
        detail = '；'.join(f'[{check}](../demo-v2-baseline/{ref}) ' + conditions[check] for check, ref in checks)
        rows.append(f'| [{line} {label}]({link(old,line)}) | {product} | {note}{detail} |')
    head = f"""# 冻结桌面控件到当前实现

[冻结控件清单](../demo-v2-baseline/controls.md) 的 {counts['lines']} 行对应 {len(ids)} 个基线编号。下表定位 {counts['located']} 行产品组件，另有 {counts['conditional']} 行属于旧个人任务页或 Windows 专属题头。每行的最后一列给出原版触发条件，点击编号可查角色、预期行为及原版取证范围。运行与业务结果按对应编号查验收总表。

冻结源码取自 MobileWork 客户端 `dbf36f4d2a9b69779c18cb5fec22ce3ee6302a69`，路径及行号指向本机恢复副本。产品源码位于本 checkout。对相同行使用文本块匹配，任务页和收件箱的装配入口单独映射。更新实现后在产品仓运行 `python3 tests/review/control_map.py` 重建索引。

- 工作区拥有者和管理员可邀请。个人区、普通成员和未入组账号的差异见 IN-05。共享调用权限、执行端所有权、探针和模型凭据按 AG、EP、PRB 的条件分别检查。
- 蓝图草案可多人编辑，发布由拥有者、管理员或项目人类负责人操作。普通成员的讨论操作可能在点击后收到权限错误。查看 BP-13、BP-14 及 TC 项中的 A/B 条件。
- 会话、工作台草稿、固定视图和运行卡按账号与工作区核对。已完成回答和动态数据样本使用受控条件。费用模型及外部 SSH 按 D-08 暂缓。
- 任务重置保留当前任务页，附件上传失败可移除、重试或取消。两项按 D-07 验收。"""
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(head + '\n' + '\n'.join(rows) + '\n')
    print(f'{counts["lines"]} frozen references; {counts["located"]} mapped, {counts["conditional"]} conditional.')


if __name__ == '__main__':
    main()
