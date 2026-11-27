"""为工作台停止测试提供本地等待窗口。不会转发请求或记录请求内容。"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import time


class HoldingEndpoint(BaseHTTPRequestHandler):
    def do_POST(self):
        self.rfile.read(int(self.headers.get("Content-Length", 0)))
        time.sleep(35)
        self.send_error(503)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 19789), HoldingEndpoint).serve_forever()
