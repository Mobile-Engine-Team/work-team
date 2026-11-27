import { z } from "zod";
import { DynamicSchema } from "./dynamic-contract";
import { ViewSchema } from "./view-contract";
const EvidenceSchema = z.object({
  id: z.string(),
  kind: z.string(),
  objectId: z.string(),
  projectId: z.string(),
  issueId: z.string(),
  topicId: z.string().optional(),
  title: z.string(),
  text: z.string(),
  status: z.string(),
  version: z.string(),
  updatedAt: z.string(),
  relatedIds: z.array(z.string()),
});
export const ResultSchema = z.object({
  view: z.union([
    ViewSchema,
    ViewSchema.extend({
      schemaVersion: z.literal(2),
      title: z.string(),
      intent: z.string(),
      queries: z.array(z.unknown()),
      blocks: z.array(z.never()),
    }),
  ]),
  dynamic: DynamicSchema.optional(),
  requestedModel: z.string().optional(),
  provider: z.string().optional(),
  runtime: z.string().optional(),
  elapsedMs: z.number().optional(),
  repairs: z.number().optional(),
  stale: z.boolean().optional(),
  evidence: z.array(EvidenceSchema),
  fingerprint: z.string(),
  generatedAt: z.string(),
  model: z.string(),
  calls: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
});
export type Result = z.infer<typeof ResultSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  prompt: z.string(),
  status: z.string(),
  progress: z.string(),
  error: z.string(),
  result: ResultSchema.nullable(),
  createdAt: z.string(),
});
export const PinSchema = z.object({
  id: z.string(),
  name: z.string(),
  intent: z.string(),
  revision: z.number(),
  refreshKey: z.string(),
  status: z.string(),
  error: z.string(),
  updatedAt: z.string(),
  result: ResultSchema.nullable(),
});
export type Message = z.infer<typeof MessageSchema>;
export type Pin = z.infer<typeof PinSchema>;
export const StateSchema = z.object({
  conversations: z.array(
    z.object({ id: z.string(), title: z.string(), createdAt: z.string() }),
  ),
  messages: z.array(MessageSchema),
  pins: z.array(PinSchema),
  catalog: z.object({
    counts: z.record(z.string(), z.number()),
    projects: z.array(
      z.object({ id: z.string(), title: z.string(), status: z.string() }),
    ),
    asOf: z.string(),
    coverage: z.string(),
  }),
  modelReady: z.boolean(),
  runtimeStatus: z.enum(["disabled", "warming", "ready", "unavailable"]).optional().catch(undefined),
  models: z
    .array(
      z.object({ id: z.string(), label: z.string(), default: z.boolean() }),
    )
    .default([]),
  fingerprint: z.string(),
});
export type State = z.infer<typeof StateSchema>;
