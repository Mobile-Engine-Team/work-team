import AppKit
import WebKit

private struct Profile {
    let name: String
    let root: URL
    let port: Int
    let dataStoreID: UUID

    init?() {
        guard let name = Bundle.main.object(forInfoDictionaryKey: "WorkbenchProfile") as? String,
              let root = Bundle.main.object(forInfoDictionaryKey: "WorkbenchRoot") as? String,
              ["a", "b"].contains(name) else { return nil }
        self.name = name
        self.root = URL(fileURLWithPath: root, isDirectory: true)
        port = name == "a" ? 18996 : 18997
        dataStoreID = UUID(uuid: (0x82, 0x10, 0x0c, 0x62, 0x8c, 0x82, 0x49, 0x53,
                                  0xbc, 0x95, 0xd4, 0x67, 0x16, 0x28, 0x3f, name == "a" ? 1 : 2))
    }

    func owns(_ url: URL) -> Bool {
        url.scheme == "http" && url.host == "127.0.0.1" && url.port == port &&
            url.user == nil && url.password == nil
    }

    func entry() throws -> URL {
        let path = root.appendingPathComponent(".local/runtime/\(name)/entry.private")
        let raw = try String(contentsOf: path, encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: raw), owns(url), url.path == "/" else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return url
    }
}

private final class Workbench: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private let profile: Profile
    private var window: NSWindow!
    private var webView: WKWebView!
    private var status: NSStackView!
    private var message: NSTextField!
    private var retry: NSButton!
    private var launching = false

    init(_ profile: Profile) {
        self.profile = profile
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore(forIdentifier: profile.dataStoreID)
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self

        message = NSTextField(wrappingLabelWithString: "")
        message.alignment = .center
        message.font = .systemFont(ofSize: 15)
        retry = NSButton(title: "重新连接", target: self, action: #selector(connect))
        status = NSStackView(views: [message, retry])
        status.orientation = .vertical
        status.alignment = .centerX
        status.spacing = 14
        status.translatesAutoresizingMaskIntoConstraints = false

        let content = NSView()
        webView.translatesAutoresizingMaskIntoConstraints = false
        content.addSubview(webView)
        content.addSubview(status)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: content.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: content.trailingAnchor),
            webView.topAnchor.constraint(equalTo: content.topAnchor),
            webView.bottomAnchor.constraint(equalTo: content.bottomAnchor),
            status.centerXAnchor.constraint(equalTo: content.centerXAnchor),
            status.centerYAnchor.constraint(equalTo: content.centerYAnchor),
            status.widthAnchor.constraint(lessThanOrEqualTo: content.widthAnchor, multiplier: 0.8),
        ])

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 800),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.contentView = content
        window.contentMinSize = NSSize(width: 700, height: 560)
        window.title = "MobileWork 团队工作台 \(profile.name.uppercased())"
        window.setFrameAutosaveName("Workbench-\(profile.name)")
        if !window.setFrameUsingName("Workbench-\(profile.name)") { window.center() }
        NSApp.mainMenu = makeMenu()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        connect()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    private func makeMenu() -> NSMenu {
        let menu = NSMenu()
        func section(_ title: String, _ commands: [NSMenuItem]) {
            let item = NSMenuItem()
            let submenu = NSMenu(title: title)
            commands.forEach { submenu.addItem($0) }
            item.submenu = submenu
            menu.addItem(item)
        }
        section("团队工作台", [NSMenuItem(title: "退出团队工作台", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")])
        section("编辑", [
            NSMenuItem(title: "撤销", action: Selector(("undo:")), keyEquivalent: "z"),
            NSMenuItem(title: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x"),
            NSMenuItem(title: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c"),
            NSMenuItem(title: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v"),
            NSMenuItem(title: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"),
        ])
        let reload = NSMenuItem(title: "刷新页面", action: #selector(refresh), keyEquivalent: "r")
        reload.target = self
        section("视图", [reload])
        return menu
    }

    private func showStatus(_ text: String, canRetry: Bool) {
        webView.isHidden = true
        status.isHidden = false
        message.stringValue = text
        retry.isHidden = !canRetry
    }

    @objc private func refresh() {
        if webView.isHidden { connect() }
        else { webView.reload() }
    }

    @objc private func connect() {
        guard !launching else { return }
        launching = true
        showStatus("正在连接本机工作台…", canRetry: false)
        let starter = Process()
        starter.executableURL = profile.root.appendingPathComponent("scripts/local")
        starter.arguments = ["start", profile.name]
        starter.standardOutput = FileHandle.nullDevice
        starter.standardError = FileHandle.nullDevice
        starter.terminationHandler = { [weak self] task in
            let success = task.terminationStatus == 0
            DispatchQueue.main.async {
                guard let self else { return }
                self.launching = false
                guard success, let url = try? self.profile.entry() else {
                    self.showStatus("工作台服务未能启动。请从产品仓运行 scripts/local status 后重试。", canRetry: true)
                    return
                }
                self.webView.load(URLRequest(url: url))
            }
        }
        do {
            try starter.run()
        } catch {
            launching = false
            showStatus("找不到本机工作台。请从原产品仓重新生成客户端。", canRetry: true)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let owned = action.request.url.map(profile.owns) ?? false
        decisionHandler(owned && action.targetFrame != nil ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if response.isForMainFrame, let http = response.response as? HTTPURLResponse, http.statusCode >= 400 {
            showStatus("本机工作台连接已失效，请重新连接。", canRetry: true)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        status.isHidden = true
        webView.isHidden = false
        window.makeFirstResponder(webView)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled {
            showStatus("无法连接本机工作台，请重新连接。", canRetry: true)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showStatus("工作台页面已结束，请重新连接。", canRetry: true)
    }
}

guard let profile = Profile() else {
    fatalError("Missing Workbench application profile")
}
let app = NSApplication.shared
private let delegate = Workbench(profile)
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
