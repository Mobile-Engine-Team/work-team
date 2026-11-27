import { QueryClient } from "@tanstack/react-query";
import { exponentialDelays } from "@/app/lib/backoff";
import { isRecoverableTeamRead } from "./request-transport";

const delays = exponentialDelays({ baseMs: 1_000, maxMs: 30_000, attempts: 6 });
export function createTeamQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (_count, error) => isRecoverableTeamRead(error),
        retryDelay: (count) => {
          const delay = delays[Math.min(count, delays.length - 1)];
          console.debug(`[retry] team-read attempt ${count + 1}`);
          return Math.round(delay * (0.8 + Math.random() * 0.2));
        },
        staleTime: 15_000,
        refetchOnWindowFocus: "always",
        refetchOnReconnect: "always",
      },
      mutations: { retry: false },
    },
  });
}

// Resume interrupts the backoff, not a business operation. Cached data stays
// mounted while fresh reads run, so editor state belongs to the existing page.
export async function resumeTeamQueries(client: QueryClient) {
  await client.cancelQueries({
    type: "active",
    predicate: (query) => isRecoverableTeamRead(query.state.fetchFailureReason),
  });
  void client.refetchQueries({ type: "active" }, { cancelRefetch: false });
}

export function subscribeTeamResume(resume: () => void) {
  const visible = () => {
    if (document.visibilityState === "visible") resume();
  };
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  document.addEventListener("visibilitychange", visible);
  return () => {
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
    document.removeEventListener("visibilitychange", visible);
  };
}
