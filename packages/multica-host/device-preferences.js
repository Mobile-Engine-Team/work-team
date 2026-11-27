import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { WorkbenchError } from "./upstream.js";

const choices = {
  theme: ["system", "light", "dark"],
  language: ["简体中文", "English"],
  close: ["退出", "保留窗口"],
};
const switches = [
  "guard",
  "fileProtection",
  "modelProtection",
  "autoLaunch",
  "daemonAutoStart",
  "daemonAutoStop",
];
const defaults = {
  version: 0,
  theme: "system",
  language: "简体中文",
  close: "退出",
  chatSize: 15,
  models: [],
  guard: true,
  fileProtection: true,
  modelProtection: true,
  autoLaunch: false,
  daemonAutoStart: false,
  daemonAutoStop: false,
};
export function devicePreferences(directory) {
  const name = join(directory, "device-preferences.json");
  let pending = Promise.resolve();
  async function read() {
    try {
      return { ...defaults, ...JSON.parse(await readFile(name, "utf8")) };
    } catch (error) {
      if (error.code === "ENOENT") return { ...defaults };
      throw error;
    }
  }
  function save(input) {
    const next = pending.then(async () => {
      const current = await read();
      if (current.version !== input.version)
        throw new WorkbenchError(409, "设备偏好已更新，请重新打开设置。");
      const value = { ...current, version: current.version + 1 };
      for (const [key, allowed] of Object.entries(choices)) {
        if (!allowed.includes(input[key]))
          throw new WorkbenchError(422, "无效的设备选项");
        value[key] = input[key];
      }
      for (const key of switches) {
        if (typeof input[key] !== "boolean")
          throw new WorkbenchError(422, "无效的设备开关");
        value[key] = input[key];
      }
      if (
        !Number.isInteger(input.chatSize) ||
        input.chatSize < 12 ||
        input.chatSize > 24
      )
        throw new WorkbenchError(422, "字号应为 12–24");
      value.chatSize = input.chatSize;
      if (
        !Array.isArray(input.models) ||
        input.models.length > 100 ||
        input.models.some(
          (m) =>
            typeof m !== "string" || !m.trim() || [...m.trim()].length > 64,
        )
      )
        throw new WorkbenchError(422, "请输入 1–64 字的模型样例名称");
      value.models = input.models.map((m) => m.trim());
      if (
        new Set(value.models.map((m) => m.toLowerCase())).size !==
        value.models.length
      )
        throw new WorkbenchError(422, "模型样例名称重复");
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const temp = name + "." + randomUUID();
      await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
      await rename(temp, name);
      return value;
    });
    pending = next.catch(() => {});
    return next;
  }
  return { read, save };
}
