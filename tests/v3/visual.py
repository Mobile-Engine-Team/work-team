"""Compose same-size reference and desktop frames in sRGB, retaining their original proportions."""
import argparse
import io
import json
import math
from pathlib import Path
from PIL import Image, ImageChops, ImageCms, ImageDraw, ImageStat

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--reference", type=Path, required=True)
parser.add_argument("--desktop", type=Path, required=True)
parser.add_argument("--desktop-reference", type=Path, help="Design captured with the same Electron engine as the desktop app")
parser.add_argument("--browser", type=Path, help="Optional independent browser replay for comparing management form coordinates")
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
desktop_reference = args.desktop_reference or args.reference
frames = {
    "蓝图发布预览": ("blueprint-preview", "demo-blueprint-preview"),
    "蓝图纳入已有任务": ("blueprint-candidates", "demo-blueprint-candidates"),
    "蓝图版本历史": ("blueprint-history", "demo-blueprint-history"),
    "多人会话": ("room", "demo-room"), "会话搜索": ("room-search", "demo-room-search"), "会话设置": ("room-settings", "demo-room-settings"),
    "任务详情": ("task-detail", "demo-task-detail"), "我的文件": ("files","demo-files"),
    "任务列表": ("task-list", "demo-task-list"), "任务泳道": ("swimlane", "demo-swimlane"),
    "任务表格": ("table", "demo-table"), "我的任务": ("mine", "demo-mine"),
    "团队设置": ("team-settings", "demo-team-settings"), "成员管理": ("members", "demo-members"), "邀请成员": ("invite", "demo-invite"),
    "通知中心": ("notifications", "demo-notifications"),
    "新建项目": ("project-create", "demo-project-create"), "项目设置": ("project-settings", "demo-project-settings"),
    "首页": ("home", "demo-home"), "项目列表": ("catalog", "demo-catalog"),
    "项目总览": ("overview", "demo-overview"), "项目任务": ("project-tasks", "demo-project-tasks"),
    "任务临时聊天": ("side-chat","demo-side-chat"),
    "任务显示选项": ("board-display", "demo-board-display"),
    "交接确认": ("handoff", "demo-handoff"), "施工蓝图": ("blueprint", "demo-blueprint"), "任务看板": ("board", "task-board"),
    "协作空间": ("space", "demo-space"), "智能体目录": ("agents", "demo-agents"),
    "小队目录": ("squads", "demo-squads"), "切换团队": ("switch", "demo-switch"),
}
srgb = ImageCms.createProfile("sRGB")
measurements = {}
for title, (reference, desktop) in frames.items():
    originals = []
    canvas = Image.new("RGB", (2160, 675), "white")
    for index, frame in enumerate((desktop_reference / (reference + ".png"), args.desktop / (desktop + ".png"))):
        with Image.open(frame) as img:
            if img.size != (1440, 900):
                raise ValueError(f"Expected 1440 × 900, got {img.size} for {frame}")
            icc = img.info.get("icc_profile")
            rgb = (ImageCms.profileToProfile(img, ImageCms.ImageCmsProfile(io.BytesIO(icc)), srgb, outputMode="RGB")
                   if icc else img.convert("RGB"))
            originals.append(rgb)
            canvas.paste(rgb.resize((1080, 675), Image.Resampling.LANCZOS), (1080 * index, 0))
    canvas.save(args.output / (title + "对照.webp"), quality=89, method=6)
    delta = ImageChops.difference(*originals)
    red, green, blue = delta.split()
    histogram = ImageChops.lighter(ImageChops.lighter(red, green), blue).histogram()
    pixels = sum(histogram)
    measurements[title] = {
        "尺寸": list(delta.size),
        "完全相同像素": histogram[0],
        "总像素": pixels,
        "各通道差值均不超过8的像素": sum(histogram[:9]),
        "RGB平均绝对差值": round(sum(ImageStat.Stat(delta).mean) / 3, 3),
    }

(args.output / "视觉像素核对.json").write_text(
    json.dumps(measurements, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

# Visible boxes are recorded by the clients in CSS pixels at their original viewport.
geometry = {}
for section in ("team-settings", "members"):
    filename = f"geometry-{section}.json"
    reference = json.loads((args.reference / filename).read_text())
    recordings = {"原型": reference}
    for label, folder in (("正式桌面", args.desktop), ("独立浏览器", args.browser)):
        if folder is None:
            continue
        recorded = json.loads((folder / filename).read_text())
        measured = {selector: recorded[selector] for selector in reference}
        if measured != reference:
            raise ValueError(f"{label} {section} geometry differs from reference: {measured} vs {reference}")
        recordings[label] = measured
    geometry[section] = recordings
(args.output / "团队表单位置核对.json").write_text(
    json.dumps(geometry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

directory_checks = {}
for section, title in (("agents", "智能体"), ("squads", "智能体小队")):
    checks = {}
    for kind, label in (("geometry", "控件位置与尺寸"), ("palette", "控件配色")):
        filename = f"{kind}-{section}.json"
        expected = json.loads((args.reference / filename).read_text())
        readings = {"原型": expected}
        for name, folder in (("正式桌面", args.desktop), ("独立浏览器", args.browser)):
            if folder is None:
                continue
            observed = json.loads((folder / filename).read_text())
            if expected != observed:
                differences = {key: [value, observed.get(key)] for key, value in expected.items()
                               if value != observed.get(key)}
                raise ValueError(f"{title} {name} {label}: {differences}")
            readings[name] = observed
        checks[label] = readings
    directory_checks[title] = checks
(args.output / "智能体与小队目录核对.json").write_text(
    json.dumps(directory_checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

# Compare each client to the design in its own browser engine. Native disclosure
# markers and fractional line metrics vary between Chromium releases.
project_checks = {}
for scene, label in (("blueprint", "施工蓝图"), ("project-tasks", "项目任务")):
    filename = f"controls-{scene}.json"
    recordings = {}
    for name, folder, baseline in (("正式桌面", args.desktop, desktop_reference),
                                    ("独立浏览器", args.browser, args.reference)):
        if folder is None:
            continue
        expected = json.loads((baseline / filename).read_text())
        recordings[name + "同引擎原型"] = expected
        observed = json.loads((folder / filename).read_text())
        for control, properties in expected.items():
            measured = observed[control]
            for key, value in properties.items():
                actual = measured[key]
                if key == "边界" and len(actual) == len(value):
                    matches = all(abs(a - b) <= 1 / 64 for a, b in zip(actual, value))
                else:
                    matches = actual == value
                if not matches:
                    raise ValueError(f"{name} {label}/{control}/{key}: {actual} vs {value}")
        recordings[name] = observed
        if scene == "project-tasks":
            x, y, w, h = expected["内部任务开关"]["边界"]
            bounds = (math.floor(x), math.floor(y), math.ceil(x + w), math.ceil(y + h))
            crops = []
            for source in (baseline / "project-tasks.png", folder / "demo-project-tasks.png"):
                with Image.open(source) as screenshot:
                    icc = screenshot.info.get("icc_profile")
                    rgb = (ImageCms.profileToProfile(screenshot, ImageCms.ImageCmsProfile(io.BytesIO(icc)),
                                                     srgb, outputMode="RGB") if icc else screenshot.convert("RGB"))
                    crops.append(rgb.crop(bounds))
            if ImageChops.difference(*crops).getbbox():
                raise ValueError(f"{name} 内部任务开关像素与同引擎原型不同")
            recordings[name + "内部任务开关像素核对"] = {"区域": bounds, "sRGB 完全一致": True}
    project_checks[label] = recordings
(args.output / "项目控件核对.json").write_text(
    json.dumps(project_checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

# Keep exact desktop layout for the document and the composer. Inline text
# baselines in predecessor rows can move the following heading by one CSS pixel.
detail_checks = {}
for label, folder, baseline in (("正式桌面", args.desktop, desktop_reference),
                                ("独立浏览器", args.browser, args.reference)):
    if folder is None:
        continue
    expected = json.loads((baseline / "geometry-task-detail.json").read_text())
    observed = json.loads((folder / "geometry-task-detail.json").read_text())
    for key, box in expected.items():
        tolerance = 1 if key in ("前置交付", "动态标题") else 1 / 64
        if max(abs(a - b) for a, b in zip(box, observed[key], strict=True)) > tolerance:
            raise ValueError(f"{label} 任务详情/{key}: {observed[key]} vs {box}")
    detail_checks[label] = {"同引擎原型": expected, "正式产品": observed}
(args.output / "任务详情控件核对.json").write_text(
    json.dumps(detail_checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

for scene, title in (("blueprint-candidates", "蓝图纳入已有任务"), ("blueprint-history", "蓝图版本历史"), ("publish-preview", "蓝图发布预览"), ("handoff", "项目交接"),
                     ("side-chat", "任务临时聊天"), ("board-display", "任务显示选项"), ("swimlane", "任务泳道"), ("room-settings", "会话设置")):
    checks = {}
    for label, folder, baseline in (("正式桌面", args.desktop, desktop_reference),
                                    ("独立浏览器", args.browser, args.reference)):
        if folder is None:
            continue
        expected = json.loads((baseline / f"geometry-{scene}.json").read_text())
        observed = json.loads((folder / f"geometry-{scene}.json").read_text())
        for key, box in expected.items():
            if max(abs(a - b) for a, b in zip(box, observed[key], strict=True)) > 1 / 64:
                raise ValueError(f"{label} {title}/{key}: {observed[key]} vs {box}")
        checks[label] = {"同引擎原型": expected, "正式产品": observed}
    (args.output / f"{title}控件核对.json").write_text(
        json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

palette_checks = {}
for theme in ("light", "dark"):
    matches = {}
    for label, folder, baseline in (("正式桌面", args.desktop, desktop_reference), ("独立浏览器", args.browser, args.reference)):
        if folder is None:
            continue
        expected = json.loads((baseline / f"theme-{theme}.json").read_text())
        observed = json.loads((folder / f"theme-{theme}.json").read_text())
        if expected != observed:
            changed = [key for key in expected if expected[key] != observed.get(key)]
            raise ValueError(f"{label} {theme} 颜色不同 {changed}")
        matches[label] = observed
    palette_checks[theme] = matches
(args.output / "工作区浅色与深色配色核对.json").write_text(json.dumps(palette_checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

file_checks = {}
for label, folder, baseline in (("正式桌面", args.desktop, desktop_reference), ("独立浏览器", args.browser, args.reference)):
    if folder is None:
        continue
    expected = json.loads((baseline / "geometry-files.json").read_text())
    observed = json.loads((folder / "geometry-files.json").read_text())
    if expected != observed:
        raise ValueError(f"{label}/我的文件 控件位置有差异: {observed} vs {expected}")
    file_checks[label] = {"同引擎原型": expected, "正式产品":observed}
(args.output / "文件页控件核对.json").write_text(json.dumps(file_checks,ensure_ascii=False,indent=2)+"\n")

glyph_checks = {}
for label, folder, baseline in (("正式桌面", args.desktop, desktop_reference), ("独立浏览器", args.browser, args.reference)):
    if folder is None:
        continue
    for scene in (("task-detail", "runtime") if label == "正式桌面" else ("task-detail",)):
        expected = json.loads((baseline / f"glyphs-{scene}.json").read_text())
        observed = json.loads((folder / f"glyphs-{scene}.json").read_text())
        if expected != observed:
            raise ValueError(f"{label}/{scene} 图形路径、画布或尺寸有差异: {observed} vs {expected}")
        glyph_checks[f"{label}/{scene}"] = observed
(args.output / "界面图标核对.json").write_text(json.dumps(glyph_checks,ensure_ascii=False,indent=2) + "\n")

# Interior points for the connected, solid card surfaces in the 850 × 680 settings dialog.
# Measure the whole surface, including its rounded ends, without matching its text content.
settings_cards = {
    "系统设置": {"语言": 145, "主题": 375, "存储位置": 480, "关闭行为": 570},
    "个性化": {"回复语气": 145, "加载提示": 235},
    "帮助与反馈": {"帮助文档": 145, "问题反馈": 240, "关于": 330},
}


def card_box(panel, y):
    painted = panel.copy()
    ImageDraw.floodfill(painted, (510, y), (255, 0, 255))
    left, top, right, bottom = ImageChops.difference(panel, painted).getbbox()
    return [left, top, right - left, bottom - top]


def compare_panels(scenes, filename):
    measurements = {}
    for section, label in scenes:
        panels = []
        for folder in (desktop_reference, args.desktop):
            with Image.open(folder / (section + ".png")) as img:
                icc = img.info.get("icc_profile")
                rgb = (ImageCms.profileToProfile(img, ImageCms.ImageCmsProfile(io.BytesIO(icc)), srgb, outputMode="RGB")
                       if icc else img.convert("RGB"))
                panels.append(rgb)
        before, after = panels
        pair = Image.new("RGB", (before.width + after.width, max(before.height, after.height)), "white")
        pair.paste(before, (0, 0))
        pair.paste(after, (before.width, 0))
        pair.save(args.output / (label + "对照.webp"), quality=89, method=6)
        measurements[label] = {"原型尺寸": list(before.size), "桌面尺寸": list(after.size)}
        if section.startswith("runtime-") and before.size != after.size:
            raise ValueError(f"{label} surface size differs: {before.size} vs {after.size}")
        if section == "runtime-directory":
            reference_bounds = json.loads((desktop_reference / "geometry-runtime.json").read_text())
            desktop_bounds = json.loads((args.desktop / "geometry-runtime.json").read_text())
            measurements[label]["相对空间资料卡的坐标与尺寸"] = {"原型": reference_bounds, "桌面": desktop_bounds}
            if reference_bounds != desktop_bounds:
                raise ValueError(f"{label} control bounds differ: {reference_bounds} vs {desktop_bounds}")
        if label in settings_cards:
            measured = {name: {"原型": card_box(before, y), "桌面": card_box(after, y)}
                        for name, y in settings_cards[label].items()}
            if args.browser is not None:
                with Image.open(args.browser / (section + ".png")) as browser_panel:
                    rgb = browser_panel.convert("RGB")
                    for name, y in settings_cards[label].items():
                        measured[name]["独立浏览器"] = card_box(rgb, y)
            for name, boxes in measured.items():
                if any(box != boxes["原型"] for box in boxes.values()):
                    raise ValueError(f"{label}/{name} card bounds differ: {boxes}")
            measurements[label]["卡片位置与尺寸"] = measured
        if before.size == after.size:
            delta = ImageChops.difference(before, after)
            measurements[label]["RGB平均绝对差值"] = round(sum(ImageStat.Stat(delta).mean) / 3, 3)
    (args.output / filename).write_text(
        json.dumps(measurements, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


compare_panels([
    ("runtime-directory", "运行时目录"), ("runtime-machine", "机器详情"), ("runtime-settings", "执行端设置"),
], "运行时面板核对.json")
compare_panels([
    ("preferences-account", "账户管理"), ("preferences-system", "系统设置"),
    ("preferences-personalization", "个性化"), ("preferences-help", "帮助与反馈"),
], "个人设置面板核对.json")
