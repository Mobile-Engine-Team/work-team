import { z } from "zod";
import { parseWithFallback } from "@multica/core/api/schema";
import { teamServer, text } from "../team/client";
import { hostFetch, teamFetch } from "../team/request-transport";
export * from "./schemas";
import { MessageSchema, type Message } from "./schemas";
export class WorkbenchAccessError extends Error {}
function headers(ws: string) {
  return {
    "X-Workspace-ID": ws,
    "Content-Type": "application/json",
  };
}
export async function request<T>(
  ws: string,
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await teamFetch(`${teamServer}/api/workbench${path}`, {
    method,
    headers: headers(ws),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    )
      throw new WorkbenchAccessError(text("wb.accessError"));
    const error: z.ZodType<{ error?: string }> = z.object({
      error: z.string().optional(),
    });
    const parsed = error.safeParse(await response.json());
    throw new Error(
      parsed.success
        ? parsed.data.error || `${text("wb.requestError")} (${response.status})`
        : `${text("wb.requestError")} (${response.status})`,
    );
  }
  const parsed = parseWithFallback<T | null>(
    await response.json(),
    schema,
    null,
    { endpoint: `workbench${path}` },
  );
  if (parsed === null) throw new Error(text("wb.invalidResponse"));
  return parsed;
}
export const IDSchema = z.object({ id: z.string() });
export const StatusSchema = z.object({ status: z.string() });
export async function streamProgress(
  ws: string,
  id: string,
  signal: AbortSignal,
  onProgress: (s: string) => void,
  onSnapshot: (m: Message) => void,
) {
  const response = await hostFetch(
    `${teamServer}/api/workbench/messages/${id}/events`,
    { headers: headers(ws), signal },
  );
  if ([401, 403, 404].includes(response.status))
    throw new WorkbenchAccessError(text("wb.accessError"));
  if (!response.ok || !response.body) throw new Error(text("wb.streamError"));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n\n")) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (frame.includes("event: revoked"))
          throw new WorkbenchAccessError(text("wb.accessError"));
        const line = frame
          .split("\n")
          .find((line) => line.startsWith("data: "));
        if (!line) continue;
        const parsed = MessageSchema.safeParse(JSON.parse(line.slice(6)));
        if (parsed.success) {
          onProgress(parsed.data.progress);
          onSnapshot(parsed.data);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
