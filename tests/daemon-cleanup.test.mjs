import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdir, mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";

test("批量停用先核对全部身份，停止本产品进程并保留占用端口的外部进程", async () => {
  const lab = await mkdtemp(join(tmpdir(), "mw-stop-"));
  const origin = "http://127.0.0.1:19115";
  const owners = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
  const fixture = join(lab, "status-cli");
  const marker = join(lab, "running");
  try {
    for (const [index, owner] of owners.entries()) {
      const folder = join(lab, "daemons", owner);
      await mkdir(folder, {recursive:true});
      await writeFile(join(folder,"identity.json"), JSON.stringify({
        owner, origin, daemonId: owner, profile:"wb-" + String(index).repeat(16),
      }));
    }
    await writeFile(fixture, `#!${process.execPath}
const fs = require("node:fs");
const marker = ${JSON.stringify(marker)};
const live = fs.readFileSync(marker,"utf8");
const owner = process.env.MULTICA_DAEMON_ID;
if (process.argv[3] === "stop") {
  fs.appendFileSync(marker+".calls",owner+"\\n");
  if (live !== owner) process.exit(1);
  fs.writeFileSync(marker,"");
} else {
  console.log(JSON.stringify({
    status: live ? "running" : "stopped", port_conflict: Boolean(live && live !== owner),
    daemon_id: live, launched_by: "team-workbench", server_url:${JSON.stringify(origin)}, profile: process.argv.at(-1),
  }));
}
`, {mode:0o700});
    const stop = () => spawnSync(process.execPath,[resolve("packages/execution-bridge/stop.js")],{
      encoding:"utf8", env:{...process.env, WORKBENCH_API:origin, WORKBENCH_STATE:lab, WORKBENCH_MULTICA_BIN:fixture},
    });
    await writeFile(marker,owners[1]);
    let result = stop();
    assert.equal(result.status,0,result.stderr);
    assert.equal(await readFile(marker,"utf8"),"");
    assert.equal(await readFile(marker+".calls","utf8"),owners[1]+"\n");

    await writeFile(marker,"another-application");
    result = stop();
    assert.equal(result.status,1);
    assert.match(result.stderr,/身份或端口冲突/);
    assert.equal(await readFile(marker,"utf8"),"another-application");
    assert.equal(await readFile(marker+".calls","utf8"),owners[1]+"\n");
  } finally {
    await rm(lab,{recursive:true,force:true});
  }
});
