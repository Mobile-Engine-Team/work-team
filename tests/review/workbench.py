from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import re
from threading import Event, Thread

from playwright.sync_api import expect

from common import answers, button, click, sql


@contextmanager
def delayed_model():
    """Provide an in-flight local generation; never send a prompt outside this Mac."""
    entered, release = Event(), Event()

    class Hold(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers.get("Content-Length", 0)))
            entered.set()
            release.wait(timeout=35)
            try:
                self.send_error(503)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 19019), Hold)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield entered
    finally:
        release.set()
        server.shutdown()
        server.server_close()
        thread.join()


def run(review, a, b, accounts, workspace, issue):
    wid, owner = workspace["id"], accounts[0]["user"]["id"]
    click(a, "新对话")
    composer = a.locator(".wb-composer textarea")
    expect(composer).to_be_visible()
    suggestion = "目前哪些工作还没完成，分别卡在哪里？"
    click(a,suggestion)
    expect(composer).to_have_value(suggestion)
    review.check("WB-02","有任务的工作区点推荐问题","只预填问句，仍可编辑和发送。")
    with delayed_model() as received:
        composer.fill("本地停用演练")
        composer.press("Enter")
        expect(button(a, "停止")).to_be_visible()
        assert received.wait(12), "本地模型端未收到请求"
        review.shot(a, "25-generating")
        a.reload(wait_until="domcontentloaded")
        click(a, "停止")
        expect(button(a, "重新回答")).to_be_visible()
        review.shot(a, "26-stopped")
        assert sql("select status from workbench_message where workspace_id=:'ws' and owner_id=:'owner' and prompt='本地停用演练'", ws=wid, owner=owner) == "cancelled"
        expect(button(a, "固定为我的视图")).to_have_count(0)
    review.check("WB-04 WB-05 WB-06 STATE-08", "A 用默认模型发送，模型端在本机保持连接；刷新后停止", "本地端收到请求；刷新可恢复，停止后显示重新回答，私有消息落库 cancelled。", image="26-stopped")
    answers(wid, owner, issue["id"])
    a.reload(wait_until="domcontentloaded")
    click(a, "复验已存回答")
    click(a, "核对交接清单")
    d = a.get_by_role("dialog", name="查看依据")
    expect(d.get_by_text("请核对附件中的两项约定")).to_be_visible()
    review.shot(a, "27-evidence")
    click(d, "打开任务")
    expect(a).to_have_url(re.compile(re.escape(issue["id"])))
    click(a, "返回这次回答")
    expect(button(a, "固定为我的视图")).to_be_visible()
    private_route = a.evaluate("location.hash")
    b.evaluate("(hash) => {location.hash = hash}", private_route)
    expect(b.locator(".wb-composer textarea")).to_be_visible()
    expect(button(b, "复验已存回答")).to_have_count(0)
    expect(b.get_by_text("检查已保存的交接快照")).to_have_count(0)
    review.check("WB-08 WB-13 WB-16 WB-19 WB-20 COMMON-03", "A 回答证据指向真实团队任务，B 打开相同私有会话链接", "A 可查看生成时快照、跳回任务和原回答；B 有输入框，看不到 A 问答与最近项。", "A/B", "27-evidence")
    with delayed_model() as refreshing:
        click(a, "固定为我的视图")
        expect(button(a, "继续调整")).to_be_visible()
        expect(button(a,"正在刷新…")).to_be_disabled()
        expect(a.get_by_text("待复核记录").first).to_be_visible()
    review.check("WB-10", "固定回答的快照指纹已过期", "自动刷新时仍显示上次表格，刷新按钮锁定。")
    review.shot(a, "28-pin")
    assert sql("select count(*) from saved_view where workspace_id=:'ws' and owner_id=:'owner'", ws=wid, owner=owner) == "1"
    expect(button(b, "交接快照")).to_have_count(0)
    click(a, "继续调整")
    expect(composer).to_have_value("核对交接清单")
    click(a, "交接快照")
    click(a, "取消固定")
    expect(button(a, "交接快照")).to_have_count(0)
    expect(button(a, "复验已存回答")).to_be_visible()
    review.check("WB-09 WB-11 WB-12", "A 固定旧版表格回答、继续调整、取消固定", "按归属落库 1 条，B 无此视图；调整预填原意图；取消后历史会话仍在。", "A/B", "28-pin")
    click(a, "七项记录夹具")
    expect(a.get_by_text("清单条目 6", exact=True)).to_be_visible()
    expect(a.get_by_text("清单条目 7", exact=True)).to_have_count(0)
    review.shot(a, "38-dynamic")
    click(a, re.compile("展开全部"))
    expect(a.get_by_text("清单条目 7", exact=True)).to_be_visible()
    a.get_by_placeholder("筛选记录").fill("条目 7")
    expect(a.get_by_text("清单条目 1", exact=True)).to_have_count(0)
    expect(a.get_by_text("清单条目 7", exact=True)).to_be_visible()
    a.get_by_placeholder("筛选记录").fill("")
    click(a, "核对负责人")
    expect(composer).to_have_value("核对负责人")
    click(a, re.compile("查看依据"))
    click(a.get_by_role("main"), "查看依据 1")
    expect(a.get_by_role("dialog", name="查看依据")).to_be_visible()
    review.check("WB-14 WB-15", "已完成的七项动态记录", "默认六条；展开、筛选、清空、追问预填和依据展开均可操作。", image="38-dynamic")
