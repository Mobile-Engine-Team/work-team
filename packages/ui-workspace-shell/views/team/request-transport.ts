export class TeamNetworkError extends Error {
  constructor(
    readonly method: string,
    readonly requestId: string,
    readonly occurredAt: string,
  ) {
    super("TEAM_NETWORK_UNAVAILABLE");
    this.name = "TeamNetworkError";
  }
}
export function isTransientNetworkError(error: unknown) {
  return (
    error instanceof TypeError &&
    /fetch|network|load failed/i.test(error.message)
  );
}
export function isRecoverableTeamRead(error: unknown) {
  return (
    error instanceof TeamNetworkError &&
    (error.method === "GET" || error.method === "HEAD")
  );
}

// The local DSH Fetch service admits GET, HEAD and POST. Method overrides are
// decoded only by the protected workbench route before forwarding to Multica.
export const hostFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin !== location.origin) throw new TypeError("Cross-origin workbench request");
  const method = request.method.toUpperCase();
  const headers = new Headers(request.headers);
  headers.delete("Authorization");
  const tunnel = !["GET", "HEAD", "POST"].includes(method);
  if (tunnel) headers.set("X-Workbench-Method", method);
  return fetch("/api/workbench/transport?path=" + encodeURIComponent(url.pathname + url.search), {
    method: tunnel ? "POST" : method,
    headers,
    body: request.body ? await request.arrayBuffer() : undefined,
    credentials: "same-origin",
    signal: request.signal,
    cache: "no-store",
  });
};

// Query owns retry scheduling. Transport sends once, with a bounded read deadline.
// No URL, payload, header or server body enters user-visible diagnostics.
export const teamFetch: typeof fetch = async (input, init) => {
  const request = input instanceof Request ? input : undefined;
  const method = (init?.method || request?.method || "GET").toUpperCase();
  const requestId =
    new Headers(init?.headers || request?.headers).get("X-Request-ID") || "";
  const read = method === "GET" || method === "HEAD";
  const callerSignal = init?.signal ?? request?.signal;
  const timeout = read ? AbortSignal.timeout(15_000) : undefined;
  const signal = timeout
    ? callerSignal
      ? AbortSignal.any([callerSignal, timeout])
      : timeout
    : callerSignal;
  try {
    const response = await hostFetch(input, { ...init, signal });
    if (read && [502, 503, 504].includes(response.status)) {
      await response.body?.cancel();
      throw new TeamNetworkError(method, requestId, new Date().toISOString());
    }
    // Keep the deadline over body consumption too; a stalled JSON body must not
    // leave the query fetching forever. Non-JSON downloads retain streaming.
    if (
      read &&
      method !== "HEAD" &&
      ![204, 205, 304].includes(response.status) &&
      response.headers.get("content-type")?.includes("application/json")
    ) {
      return new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
  } catch (error) {
    if (callerSignal?.aborted) throw error;
    if (isTransientNetworkError(error) || timeout?.aborted)
      throw new TeamNetworkError(method, requestId, new Date().toISOString());
    throw error;
  }
};
