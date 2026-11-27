import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Local account root is resolved by the desktop identity authority, never by IPC input.
export function createTeamPersonal({ accountRoot }) {
  let queue = Promise.resolve();
  return {
    handle(action, payload) {
      const root = accountRoot();
      if (!root) throw new Error("Sign in to your personal account first");
      const execute = async () => {
        const file = path.join(root, "team-links.json");
        let links = [];
        try {
          links = JSON.parse(await fs.readFile(file, "utf8"));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
        if (!Array.isArray(links))
          throw new Error("Invalid personal team links");
        if (action === "team:personalLinks") return { ok: true, links };
        if (action !== "team:savePersonalLink")
          throw new Error("Unknown personal team action");
        const keys = [
          "sessionId",
          "sourceRoute",
          "serverUrl",
          "teamUserId",
          "workspaceSlug",
          "issueId",
          "title",
        ];
        if (
          keys.some(
            (key) => typeof payload[key] !== "string" || !payload[key].trim(),
          )
        )
          throw new Error("Missing personal team link field");
        if (
          !/^\/(session(?:\/|$)|workspace\/[^/]+\/session(?:\/|$))/.test(
            payload.sourceRoute,
          )
        )
          throw new Error("Invalid personal task route");
        const link = Object.fromEntries(keys.map((key) => [key, payload[key]]));
        const existing = links.find(
          (item) =>
            item.sessionId === link.sessionId &&
            item.serverUrl === link.serverUrl &&
            item.teamUserId === link.teamUserId &&
            item.issueId === link.issueId,
        );
        if (!existing) links.push({ ...link, id: randomUUID() });
        await fs.mkdir(root, { recursive: true, mode: 0o700 });
        const tmp = `${file}.${randomUUID()}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(links, null, 2), {
          mode: 0o600,
        });
        await fs.rename(tmp, file);
        return { ok: true, links };
      };
      const next = queue.then(execute);
      queue = next.catch(() => {});
      return next;
    },
  };
}
