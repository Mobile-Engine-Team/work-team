import ApplicationServices
import Foundation

// Activate the same accessibility tree used by screen readers on Electron.
let app = AXUIElementCreateApplication(Int32(CommandLine.arguments[1])!)
AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
let labels: Set<String> = ["账号", "密码", "账号密码登录", "没有账号？注册账号"]
var found: Set<String> = []
var queue: [AXUIElement] = [app]
var visited = 0
while !queue.isEmpty && visited < 1500 {
    let item = queue.removeLast()
    visited += 1
    for key in ["AXTitle", "AXDescription", "AXValue", "AXPlaceholderValue"] {
        var value: CFTypeRef?
        if AXUIElementCopyAttributeValue(item, key as CFString, &value) == .success,
           let text = value as? String, labels.contains(text) {
            found.insert(text)
        }
    }
    var children: CFTypeRef?
    if AXUIElementCopyAttributeValue(item, kAXChildrenAttribute as CFString, &children) == .success,
       let list = children as? [AXUIElement] {
        queue.append(contentsOf: list)
    }
}
print(found.sorted().joined(separator: "\n"))
