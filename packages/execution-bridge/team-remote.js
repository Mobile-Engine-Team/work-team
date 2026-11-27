import ssh2 from "ssh2";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export function validateRemoteHost(payload) {
  if (typeof payload.host !== "string" || !/^[a-zA-Z0-9.:[\]_-]+$/.test(payload.host) ||
      !Number.isInteger(payload.port) || payload.port < 1 || payload.port > 65535 ||
      typeof payload.username !== "string" || !payload.username.trim() ||
      !["password", "key"].includes(payload.auth)) throw new Error("REMOTE_INPUT");
  const url = new URL(payload.remoteServerUrl);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("REMOTE_INPUT");
  return url.origin;
}

/** SSH bootstraps a member profile; task transport remains the native daemon protocol. */
export function createTeamRemote({ userDataDir, serverUrl, confirmHost, chooseKey, request = fetch, Client = ssh2.Client }) {
  let pending = false;
  return {
    async connect(payload) {
      if (pending) throw new Error("REMOTE_BUSY");
      pending = true;
      let connection;
      try {
        const remoteServerUrl = validateRemoteHost(payload);
        if (payload.serverUrl !== new URL(serverUrl).origin) throw new Error("REMOTE_IDENTITY");
        const response = await request(`${payload.serverUrl}/api/me`, {
          headers: { Authorization: `Bearer ${payload.token}` }, signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok || (await response.json()).id !== payload.userId) throw new Error("REMOTE_IDENTITY");
        const privateKey = payload.auth === "key" ? await chooseKey() : undefined;
        if (payload.auth === "key" && !privateKey) throw new Error("REMOTE_CANCELLED");
        const pinsPath = path.join(userDataDir, "team-ssh-hosts.json");
        let pins = {};
        try { pins = JSON.parse(await fs.readFile(pinsPath, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
        const hostKey = `${payload.host}:${payload.port}`;
        connection = new Client();
        let failure = "REMOTE_CONNECT_FAILED";
        await new Promise((resolve, reject) => {
          connection.once("ready", resolve).once("error", () => reject(new Error(failure)));
          connection.connect({
            host: payload.host, port: payload.port, username: payload.username,
            ...(privateKey ? { privateKey, passphrase: payload.password } : { password: payload.password }),
            readyTimeout: 20_000,
            hostVerifier: (key, accept) => {
              const fingerprint = `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}`;
              if (pins[hostKey]) {
                if (pins[hostKey] !== fingerprint) failure = "REMOTE_HOST_CHANGED";
                accept(pins[hostKey] === fingerprint);
                return;
              }
              void (async () => {
                if (!await confirmHost(hostKey, fingerprint)) { failure = "REMOTE_CANCELLED"; accept(false); return; }
                pins[hostKey] = fingerprint;
                await fs.mkdir(userDataDir, { recursive: true });
                await fs.writeFile(pinsPath, JSON.stringify(pins), { mode: 0o600 });
                accept(true);
              })().catch(() => { failure = "REMOTE_CONNECT_FAILED"; accept(false); });
            },
          });
        });
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => { connection.destroy(); reject(new Error("REMOTE_TIMEOUT")); }, 80_000);
          const finish = (error, result) => { clearTimeout(timer); error ? reject(error) : resolve(result); };
          connection.once("error", () => finish(new Error("REMOTE_CONNECT_FAILED")));
          connection.exec("multica daemon connect", (error, stream) => {
            if (error) { finish(new Error("REMOTE_CONNECT_FAILED")); return; }
            let output = "";
            stream.on("data", (chunk) => {
              output += chunk.toString();
              if (output.length > 65536) { connection.destroy(); finish(new Error("REMOTE_CONNECT_FAILED")); }
            });
            // Never forward remote stderr: it can contain paths or credentials.
            stream.stderr.resume();
            stream.on("error", () => finish(new Error("REMOTE_CONNECT_FAILED")));
            stream.on("close", (code) => {
              if (code !== 0) { finish(new Error("REMOTE_SETUP_FAILED")); return; }
              try {
                const result = JSON.parse(output);
                if (result.ok !== true || result.state !== "running" || typeof result.daemonId !== "string") throw new Error();
                finish(null, { ok: true, state: "running", daemonId: result.daemonId });
              } catch { finish(new Error("REMOTE_SETUP_FAILED")); }
            });
            stream.end(JSON.stringify({ server_url: remoteServerUrl, token: payload.token, user_id: payload.userId }));
          });
        });
      } finally {
        connection?.end();
        pending = false;
      }
    },
  };
}
