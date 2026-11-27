// Electron 的 role 提供动作与快捷键，但默认 label 是英文，需由应用翻译。
// 菜单跟随系统首选语言；不使用区域格式或渲染层的语言设置。
const labels = {
  "zh-Hans": {
    settings: "设置…", file: "文件", edit: "编辑", speech: "语音", view: "显示",
    sidebar: "切换侧边栏", window: "窗口",
    about: "关于 {appName}", services: "服务", hide: "隐藏 {appName}",
    hideothers: "隐藏其他", unhide: "全部显示", quit: "退出 {appName}",
    close: "关闭窗口", undo: "撤销", redo: "重做", cut: "剪切", copy: "拷贝",
    paste: "粘贴", pasteandmatchstyle: "粘贴并匹配样式", delete: "删除", selectall: "全选",
    startspeaking: "开始朗读", stopspeaking: "停止朗读",
    reload: "重新加载", forcereload: "强制重新加载", toggledevtools: "切换开发者工具",
    resetzoom: "实际大小", zoomin: "放大", zoomout: "缩小", togglefullscreen: "切换全屏",
    minimize: "最小化", zoom: "缩放", front: "全部置于顶层",
  },
  "zh-Hant": {
    settings: "設定…", file: "檔案", edit: "編輯", speech: "語音", view: "顯示",
    sidebar: "切換側邊欄", window: "視窗",
    about: "關於 {appName}", services: "服務", hide: "隱藏 {appName}",
    hideothers: "隱藏其他", unhide: "顯示全部", quit: "結束 {appName}",
    close: "關閉視窗", undo: "還原", redo: "重做", cut: "剪下", copy: "拷貝",
    paste: "貼上", pasteandmatchstyle: "貼上並符合樣式", delete: "刪除", selectall: "全選",
    startspeaking: "開始朗讀", stopspeaking: "停止朗讀",
    reload: "重新載入", forcereload: "強制重新載入", toggledevtools: "切換開發者工具",
    resetzoom: "實際大小", zoomin: "放大", zoomout: "縮小", togglefullscreen: "切換全螢幕",
    minimize: "縮小", zoom: "縮放", front: "全部移至最前",
  },
};

/** @param {string[]} preferredLanguages @returns {"zh-Hans" | "zh-Hant" | "en"} */
export function resolveMenuLanguage(preferredLanguages) {
  for (const language of preferredLanguages) {
    let locale;
    try {
      locale = new Intl.Locale(language.replaceAll("_", "-"));
    } catch {
      continue;
    }
    if (locale.language === "en") return "en";
    if (locale.language === "zh") {
      return locale.maximize().script === "Hant" ? "zh-Hant" : "zh-Hans";
    }
  }
  // 与现有安装包保留的中英文语言资源一致。
  return "en";
}

/**
 * 只替换文案；role、accelerator、click、DevTools 策略等保留在主菜单模板中。
 * @param {import("electron").MenuItemConstructorOptions[]} template
 * @param {string[]} preferredLanguages
 * @param {string} appName
 * @returns {import("electron").MenuItemConstructorOptions[]}
 */
export function localizeApplicationMenu(template, preferredLanguages, appName) {
  const language = resolveMenuLanguage(preferredLanguages);
  if (language === "en") return template;
  const catalog = labels[language];
  /** @param {import("electron").MenuItemConstructorOptions[]} items */
  const translate = (items) => items.map((item) => {
    const key = item.id ?? item.role?.toLowerCase();
    const label = catalog[key];
    return {
      ...item,
      ...(label ? { label: label.replace("{appName}", appName) } : {}),
      ...(Array.isArray(item.submenu) ? { submenu: translate(item.submenu) } : {}),
    };
  });
  return translate(template);
}
