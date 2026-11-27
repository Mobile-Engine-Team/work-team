import type { Issue } from "@multica/core/types";
import { teamApi } from "./client";

export async function allProjectIssues(projectId: string, options: { includeUnassigned?: boolean } = {}) {
  const filter = options.includeUnassigned
    ? { project_ids:[projectId], include_no_project:true, sort:"created_at" as const, sort_direction:"asc" as const }
    : { project_id:projectId };
  const issues = new Map<string, Issue>();
  let offset = 0;
  for (;;) {
    const page = await teamApi.listIssues({...filter, limit:100, offset});
    for (const issue of page.issues) issues.set(issue.id,issue);
    offset += page.issues.length;
    if (!page.issues.length || offset >= page.total) return [...issues.values()];
  }
}
