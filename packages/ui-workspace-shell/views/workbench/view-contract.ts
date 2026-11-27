// Generated from Multica view.schema.json by scripts/sync-workbench-contract.mjs.
import { z } from "zod";
export const ViewSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().min(1).max(300),
    intent: z.string().min(1).max(8000),
    queries: z
      .array(
        z
          .object({
            source: z.enum([
              "issue",
              "project",
              "comment",
              "topic",
              "conclusion",
              "blueprint",
              "resource",
              "dependency",
            ]),
            projectId: z.string().optional(),
            status: z.string().optional(),
            text: z.string().optional(),
            relatedId: z.string().optional(),
            offset: z.number().int().min(0).optional(),
            limit: z.number().int().min(1).max(80).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(15),
    semantic: z.boolean(),
    blocks: z
      .array(
        z
          .object({
            type: z.enum([
              "text",
              "metrics",
              "list",
              "table",
              "timeline",
              "relations",
            ]),
            title: z.string().max(300),
            text: z.string().max(5000).optional(),
            columns: z.array(z.string().max(150)).max(10).optional(),
            items: z
              .array(
                z
                  .object({
                    title: z.string().max(500),
                    text: z.string().max(4000).optional(),
                    value: z.string().max(300).optional(),
                    group: z.string().max(300).optional(),
                    evidenceIds: z.array(z.string()).max(30),
                    cells: z.array(z.string().max(4000)).max(10).optional(),
                  })
                  .strict(),
              )
              .max(120),
            evidenceIds: z.array(z.string()).max(60),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    limitations: z.array(z.string().max(1500)).max(20),
    timeSensitive: z.boolean().optional(),
  })
  .strict();
export type ViewSpec = z.infer<typeof ViewSchema>;
