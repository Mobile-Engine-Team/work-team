import { useState, useRef } from "react";
import { z } from "zod";
// Durable draft attachment metadata; signed URLs are deliberately not persisted.
const AttachmentSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  issue_id: z.string().nullable(),
  comment_id: z.string().nullable(),
  chat_session_id: z.string().nullable(),
  chat_message_id: z.string().nullable(),
  uploader_type: z.string(),
  uploader_id: z.string(),
  filename: z.string(),
  url: z.string().transform(() => ""),
  download_url: z.string().transform(() => ""),
  markdown_url: z.string(),
  content_type: z.string(),
  size_bytes: z.number(),
  created_at: z.string(),
});

export const DraftSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  startDate: z.string().default(""),
  labels: z.string().default(""),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
  dueDate: z.string().default(""),
  projectID: z.string().default(""),
  owner: z.string().default("none"),
  status: z.string().default("backlog"),
  mode: z.enum(["manual", "agent"]).default("manual"),
  excerpts: z.array(z.string()).default([]),
  workspaceSlug: z.string().default(""),
  excludedArtifacts: z.array(z.string()).default([]),
  files: z.array(AttachmentSchema).default([]),
  uploadedArtifacts: z.record(z.string(), AttachmentSchema).default({}),
  draftPrompt: z.string().default(""),
  appliedDraftRequestID: z.string().optional(),
  draftRequestID: z.string().optional(),
  draftAgentID: z.string().default(""),
  draftConfirmed: z.boolean().default(false),
  generated: z.boolean().default(false),
  pendingTaskId: z.string().optional(),
  pendingAgentId: z.string().optional(),
  created: z.object({ id: z.string(), title: z.string() }).optional(),
});
export type TeamDraft = z.infer<typeof DraftSchema>;
export function addExcerpt(excerpts: string[], selection: string) {
  const value = selection.trim();
  return !value || excerpts.some((s) => s.trim() === value)
    ? excerpts
    : [...excerpts, value];
}
// Only UI drafts, scoped to account + server + source session. No credential is stored here.
export function useTeamDraft(key: string) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return {
        draft: DraftSchema.parse(saved ? JSON.parse(saved) : {}),
        error: null as Error | null,
      };
    } catch (error) {
      return {
        draft: DraftSchema.parse({}),
        error:
          error instanceof Error ? error : new Error("Draft could not be read"),
      };
    }
  });
  const current = useRef(state.draft);
  const update = (patch: Partial<TeamDraft>) => {
    const next = { ...current.current, ...patch };
    current.current = next;
    // Write at the user action boundary; navigating immediately afterwards cannot lose edits.
    try {
      localStorage.setItem(key, JSON.stringify(DraftSchema.parse(next)));
      setState({ draft: next, error: null });
    } catch (error) {
      setState({
        draft: next,
        error:
          error instanceof Error
            ? error
            : new Error("Draft could not be saved"),
      });
    }
  };
  const clear = () => {
    localStorage.removeItem(key);
    current.current = DraftSchema.parse({});
    setState({ draft: current.current, error: null });
  };
  return { ...state, update, clear };
}

export function generatedDraftPatch(
  draft: TeamDraft,
  result:
    | {
        id: string;
        status: string;
        draft: {
          title: string;
          description: string;
          due_date: string;
          questions: string[];
        } | null;
      }
    | undefined,
): Partial<TeamDraft> | null {
  if (
    !result ||
    result.id !== draft.draftRequestID ||
    result.id === draft.appliedDraftRequestID ||
    result.status !== "succeeded" ||
    !result.draft
  )
    return null;
  return {
    title: result.draft.title,
    description: result.draft.description,
    dueDate: result.draft.due_date,
    appliedDraftRequestID: result.id,
    generated: true,
    draftConfirmed: false,
  };
}
