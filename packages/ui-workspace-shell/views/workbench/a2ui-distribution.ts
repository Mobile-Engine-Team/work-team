import { z } from "zod";

// Server-computed aggregate (Go aggregateDistribution). The client only
// validates its shape and arranges it for display; it never recounts.
const count = z.number().int().nonnegative();
export const distributionSchema = z
  .object({
    field: z.string(),
    seriesField: z.string(),
    series: z.array(z.string()).max(20),
    groups: z
      .array(
        z
          .object({
            key: z.string(),
            label: z.string(),
            recordId: z.string(),
            total: count,
            values: z.record(z.string(), count),
            evidenceIds: z.array(z.string()),
          })
          .strict(),
      )
      .max(80),
  })
  .strict()
  .superRefine((d, ctx) => {
    if (new Set(d.series).size !== d.series.length)
      ctx.addIssue({ code: "custom", message: "duplicate_series" });
    if (!d.seriesField && d.series.some((s) => s !== "count"))
      ctx.addIssue({ code: "custom", message: "unexpected_series" });
    for (const g of d.groups) {
      const keys = Object.keys(g.values);
      if (
        keys.length !== d.series.length ||
        keys.some((k) => !d.series.includes(k))
      )
        ctx.addIssue({ code: "custom", message: "series_mismatch" });
      if (Object.values(g.values).reduce((a, b) => a + b, 0) !== g.total)
        ctx.addIssue({ code: "custom", message: "total_mismatch" });
    }
  });
export type Distribution = z.infer<typeof distributionSchema>;
export type DistributionGroup = Distribution["groups"][number];

export const isStatusField = (field: string) =>
  field.toLowerCase().endsWith("status");
// Workflow order: finished work on the left, open work, then exceptions.
const STATUS_ORDER = [
  "done",
  "completed",
  "in_review",
  "in_progress",
  "active",
  "todo",
  "planned",
  "backlog",
  "on_hold",
  "blocked",
  "cancelled",
];
export type Tone = "positive" | "info" | "review" | "neutral" | "warning" | "quiet";
const STATUS_TONE: Record<string, Tone> = {
  done: "positive",
  completed: "positive",
  current: "positive",
  in_review: "review",
  in_progress: "info",
  active: "info",
  working: "info",
  blocked: "warning",
  on_hold: "warning",
  cancelled: "quiet",
  superseded: "quiet",
};
export const statusTone = (status: unknown): Tone =>
  STATUS_TONE[String(status)] || "neutral";

/** Display order for series; status follows workflow, others keep server order. */
export function orderSeries(d: Distribution) {
  if (!isStatusField(d.seriesField)) return d.series;
  const rank = (s: string) => {
    const i = STATUS_ORDER.indexOf(s);
    return i === -1 ? STATUS_ORDER.length : i;
  };
  return [...d.series].sort((a, b) => rank(a) - rank(b));
}
/** Largest groups first; the unset group (empty key) always last. */
export function orderGroups(d: Distribution) {
  return [...d.groups].sort(
    (a, b) =>
      Number(a.key === "") - Number(b.key === "") ||
      b.total - a.total ||
      a.label.localeCompare(b.label),
  );
}
/**
 * Color slot per series. Status series use per-status semantic colors; others take
 * fixed categorical slots by their position in `series`, never by rank, and
 * fold into a neutral slot past the palette size instead of cycling.
 */
const CATEGORICAL_SLOTS = 5;
const statusColor = (status: string) =>
  `s-${STATUS_ORDER.includes(status) ? status : "other"}`;
export function groupColor(d: Distribution, key: string) {
  return isStatusField(d.field) ? statusColor(key) : "cat-1";
}
export function seriesColor(d: Distribution, series: string) {
  if (isStatusField(d.seriesField)) return statusColor(series);
  if (!d.seriesField) return "cat-1";
  const i = d.series.indexOf(series);
  return i >= 0 && i < CATEGORICAL_SLOTS ? `cat-${i + 1}` : "cat-other";
}
/** Common scale across groups so bar lengths compare real counts. */
export const distributionMax = (d: Distribution) =>
  d.groups.reduce((m, g) => Math.max(m, g.total), 0);
