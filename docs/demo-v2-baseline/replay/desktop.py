"""在冻结版同一台 Mac 上从新库和两个空资料目录启动一轮交互复验。"""
from contextlib import ExitStack
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from urllib.request import urlopen
import hashlib
import json
import os
import runpy
import secrets
import shutil
import signal
import socket
import subprocess
import time

ROOT = next(p for p in Path(__file__).resolve().parents if (p / "project/current.md").is_file())
SOURCE = ROOT / ".local/demo-v2/src"
CLIENT = SOURCE / "mobile-work-client"
MULTICA = SOURCE / "multica"
BACKUP = ROOT / ".local/demo-versions/demo-v2-20261117"
STAGED = ROOT / ".local/demo-versions/v2-local-20261119/.local/demo-v2"
OUT = STAGED / "aliyun-20261117/unified-chat"
APPS = STAGED / "src/mobile-work-client/.local/v2/local-handtest-20261117"
SNAPSHOT = "v2_chat_verify_20261117_110837"
API = "http://127.0.0.1:19782"
UI = "http://127.0.0.1:14782"


def verify_uploads(directory):
    entries = {}
    for file in directory.rglob("*"):
        if file.is_file():
            with file.open("rb") as stream:
                entries[str(file.relative_to(directory))] = hashlib.file_digest(stream, "sha256").hexdigest()
    encoded = json.dumps(entries, sort_keys=True, ensure_ascii=True, separators=(",", ":")).encode()
    if len(entries) != 24 or hashlib.sha256(encoded).hexdigest() != "51cb2a0495d8b40cad0ba22e2463e6afc96a85ebc5a7c62d0987a957c77abb22":
        raise RuntimeError("本轮附件副本与 24 个冻结文件的名称和内容指纹不符")


def wait_url(url):
    for _ in range(120):
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return response.read()
        except OSError:
            time.sleep(.25)
    raise RuntimeError(f"本次复验启动超时，请查本轮日志 {url}")


def close_process(process):
    if process.poll() is None:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()


def main():
    os.umask(0o077)
    executable = os.environ.get("WORKBENCH_V2_ELECTRON")
    electron = (Path(executable) if executable else
                next(iter(sorted(APPS.glob("MW-V2-Local-*.app/Contents/MacOS/Electron"))), None))
    if electron is None or not electron.is_file():
        raise RuntimeError("找不到归档 Electron，请用 WORKBENCH_V2_ELECTRON 指定可执行文件")
    for directory, revision in [(CLIENT, "dbf36f4d2a9b69779c18cb5fec22ce3ee6302a69"),
                                (MULTICA, "a7859a4715fd589d9460512ad805588210a5f0c5")]:
        actual = subprocess.check_output(["git", "-C", directory, "rev-parse", "HEAD"], text=True).strip()
        if actual != revision:
            raise RuntimeError("源码版本与冻结清单不符")
        subprocess.run(["git", "-C", directory, "diff", "--quiet", "HEAD", "--"], check=True)
    for port in (14782, 19782, 19789):
        with socket.socket() as test:
            test.bind(("127.0.0.1", port))
    for file, expected in [(BACKUP / (SNAPSHOT + ".dump"), "bd5b5e635cf8d3cd4d7c496a56052b8d55b4db2dfd1add2deff58be4ebc30ab4"),
                           (OUT / "server-mac-r5", "a66fb188ba6b2ad59afde99d1729018ead33f6788347053cca28fa7903048e62")]:
        with file.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != expected:
                raise RuntimeError(f"文件指纹不符 {file.name}")

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + secrets.token_hex(3)
    lab = ROOT / ".local" / ("v2-review-" + run_id)
    lab.mkdir()
    print(f"本轮工作目录 {lab}", flush=True)
    pg = runpy.run_path(str(ROOT / ".local/demo-v2/aliyun-20261117/localdb.py"))
    pg_env, tools = pg["env"](), pg["TOOL"]
    if (pg_env["PGHOST"], pg_env["PGPORT"]) != ("127.0.0.1", "54329"):
        raise RuntimeError("请先按恢复文档启动本机 54329 的冻结依赖")
    database = "v2_chat_verify_review_" + run_id
    subprocess.run([tools / "createdb", database], env=pg_env, check=True)
    subprocess.run([tools / "pg_restore", "--no-owner", "--no-acl", "--exit-on-error",
                    "-d", database, BACKUP / (SNAPSHOT + ".dump")], env=pg_env, check=True)
    result = subprocess.check_output([tools / "psql", "-XAt", "-v", "ON_ERROR_STOP=1", "-d", database,
                                      "-f", BACKUP / (SNAPSHOT + ".sql")], env=pg_env, text=True)
    if result.strip() != (BACKUP / (SNAPSHOT + ".fingerprint")).read_text().strip():
        raise RuntimeError("恢复库指纹不符")
    shutil.copytree(OUT / "local-uploads", lab / "uploads")
    verify_uploads(lab / "uploads")
    config = pg["values"]()
    db_url = urlunparse(urlparse(config["DATABASE_URL"])._replace(path="/" + database))
    env = {k: os.environ[k] for k in ("HOME", "USER", "LOGNAME", "PATH", "LANG", "TMPDIR") if k in os.environ}
    node_bin = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
    env["PATH"] = str(node_bin) + ":" + env["PATH"]
    with ExitStack() as scope:
        def start(label, command, folder, **settings):
            log = scope.enter_context((lab / (label + ".log")).open("ab"))
            process = subprocess.Popen(command, cwd=folder, env={**env, **settings},
                                       stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
            scope.callback(close_process, process)
            return process

        start("api", [OUT / "server-mac-r5"], MULTICA / "server", DATABASE_URL=db_url, PORT="19782",
              JWT_SECRET=secrets.token_hex(40), FRONTEND_ORIGIN=UI, CORS_ALLOWED_ORIGINS=UI,
              MULTICA_PUBLIC_URL=API, MULTICA_SERVER_URL="ws://127.0.0.1:19782/ws", MULTICA_APP_URL=UI,
              LOCAL_UPLOAD_DIR=str(lab / "uploads"), LOCAL_UPLOAD_BASE_URL=API, MW_DEMO_PASSWORD_AUTH="1",
              MULTICA_WORKBENCH_PI_SCRIPT=str(MULTICA / "server/workbench-pi/main.mjs"),
              MULTICA_WORKBENCH_PRO_ENABLED="0", MULTICA_LLM_API_KEY="isolated-fixture",
              MULTICA_LLM_BASE_URL="http://127.0.0.1:19789", MULTICA_LLM_DEFAULT_MODEL=config["MULTICA_LLM_DEFAULT_MODEL"])
        health = json.loads(wait_url(API + "/health"))
        if health.get("commit") != "b0bd2169-repair-fallback-r5-20261117":
            raise RuntimeError("API build 不符")
        start("renderer", [CLIENT / "apps/app/node_modules/.bin/vite", "--host", "127.0.0.1",
                           "--port", "14782", "--strictPort"], CLIENT / "apps/app", PORT="14782",
              VITE_TEAM_API_URL=API, MW_TEAM_API_URL=API, VITE_MW_DEMO_PASSWORD_AUTH="1")
        wait_url(UI + "/team-pilot.html")
        def open_window(label):
            sdk = lab / (label + "-home")
            sdk.mkdir(exist_ok=True)
            return start(label, [electron,
                          CLIENT / "apps/desktop/electron/main.mjs"], CLIENT, PORT="14782",
                  MOBILEWORK_ELECTRON_USERDATA=str(lab / label), MOBILEWORK_MC_SDK_HOME=str(sdk),
                  MW_TEAM_AGENT_HOME=str(sdk), MW_TEAM_CLI_PATH=str(MULTICA / ".local/v2-evidence/multica"),
                  MOBILEWORK_ELECTRON_START_URL=UI + "/team-pilot.html", MW_TEAM_API_URL=API,
                  MW_DEMO_PASSWORD_AUTH="1", MW_ENGINE_PREWARM="0", MOBILEWORK_DEV_MODE="1",
                  MOBILEWORK_DEV_WINDOW_LABEL="V2 Baseline " + label)
        windows = {label: open_window(label) for label in ("A", "B")}
        print(f"本轮数据库 {database}。完成时请先停用自己启动的本机执行端，再回到此终端按回车。", flush=True)
        while True:
            selection = input("手动退出某个窗口后输入 A 或 B 可恢复同一资料，直接回车结束本轮：").strip().upper()
            if not selection:
                break
            if selection in windows and windows[selection].poll() is not None:
                windows[selection] = open_window(selection)
            else:
                print("只有已彻底退出的 A 或 B 窗口可单独重开。", flush=True)


if __name__ == "__main__":
    main()
