import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

// Native CLI owns its credential store. The renderer sees only file-config presence.
export function createTeamModelAuth({ chooseAuthFile, launch = spawn }) {
  let login = null;
  let loginError = false;
  const status = async (home) => {
    let configured = false;
    let credentialVersion;
    try {
      const file = await fs.open(path.join(home, "auth.json"), "r");
      try {
        const data = JSON.parse(await file.readFile("utf8"));
        configured = Boolean(data.OPENAI_API_KEY || data.tokens?.access_token);
        if (configured) credentialVersion = (await file.stat()).mtimeMs;
      } finally {
        await file.close();
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error("MODEL_AUTH_INVALID");
    }
    return { configured, credentialVersion, signingIn: Boolean(login), loginError };
  };
  return {
    cancel() {
      login?.kill();
      login = null;
      loginError = false;
    },
    async handle(action, { home, env }) {
      if (action === "team:modelAuthStatus") return status(home);
      await fs.mkdir(home, { recursive: true, mode: 0o700 });
      if (action === "team:importModelAuth") {
        if (login) throw new Error("MODEL_AUTH_BUSY");
        const source = await chooseAuthFile();
        if (!source) return status(home);
        const data = await fs.readFile(source, "utf8");
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          throw new Error("MODEL_AUTH_INVALID");
        }
        if (!parsed.OPENAI_API_KEY && !parsed.tokens?.access_token)
          throw new Error("MODEL_AUTH_INVALID");
        const target = path.join(home, "auth.json");
        await fs.writeFile(`${target}.tmp`, data, { mode: 0o600 });
        await fs.rename(`${target}.tmp`, target);
        loginError = false;
      } else if (action === "team:loginModel") {
        if (!login) {
          loginError = false;
          const child = launch(
            env.MULTICA_CODEX_PATH || "codex",
            ["-c", 'cli_auth_credentials_store="file"', "login"],
            {
              env: { ...env, CODEX_HOME: home },
              stdio: "ignore",
              windowsHide: true,
            },
          );
          login = child;
          child.once("error", () => {
            if (login === child) {
              login = null;
              loginError = true;
            }
          });
          child.once("exit", (code) => {
            if (login === child) {
              login = null;
              loginError = code !== 0;
            }
          });
        }
      } else throw new Error("Unknown model auth action");
      return status(home);
    },
  };
}
