import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { useTeam } from "../team/client";
import { request } from "./api";

const readiness = z.object({ modelReady: z.boolean(), runtimeStatus: z.string() });

export function useWorkModelAvailability(enabled = true) {
  const { workspace, user } = useTeam();
  const result = useQuery({
    queryKey: ["team", workspace.id, "work-model-readiness", user.id],
    queryFn: () => request(workspace.id, "/model-readiness", readiness),
    enabled,
    refetchInterval: query => query.state.data?.runtimeStatus === "warming" ? 1500 : 15000,
  });
  return result.isError ? undefined : result.data?.modelReady;
}
