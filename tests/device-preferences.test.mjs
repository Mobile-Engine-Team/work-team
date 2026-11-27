import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { devicePreferences } from "../packages/multica-host/device-preferences.js";

async function profile(t) {
  const dir = await mkdtemp(join(tmpdir(), "mw-device-prefs-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return { dir, store: devicePreferences(dir) };
}

test("同时保存同一设备版本只有一个写入成功，重新打开可读回胜出的偏好", async (t) => {
  const { dir, store } = await profile(t);
  const initial = await store.read();
  const results = await Promise.allSettled([
    store.save({ ...initial, theme: "dark" }),
    store.save({ ...initial, chatSize: 18 }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const conflict = results.find((r) => r.status === "rejected");
  assert.equal(conflict.reason.status, 409);
  const persisted = await devicePreferences(dir).read();
  const saved = results.find((r) => r.status === "fulfilled").value;
  assert.deepEqual(persisted, saved);
  assert.equal(persisted.version, initial.version + 1);
});

test("设备拒绝同名模型及非法字号，失败保留版本，其他设备的模型清单独立", async (t) => {
  const { store } = await profile(t);
  const other = await profile(t);
  const initial = await store.read();
  const saved = await store.save({ ...initial, models: ["供应商 Test"] });
  await assert.rejects(
    store.save({ ...saved, models: ["供应商 Test", "供应商 TEST"] }),
    { status: 422 },
  );
  await assert.rejects(store.save({ ...saved, chatSize: 90 }), { status: 422 });
  assert.deepEqual(await store.read(), saved);
  assert.deepEqual((await other.store.read()).models, []);
  const removed = await store.save({ ...saved, models: [] });
  assert.deepEqual(removed.models, []);
  assert.equal(removed.version, saved.version + 1);
});
