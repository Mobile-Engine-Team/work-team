import { z } from "zod";
import { A2UI_SDK, A2UI_RUNTIME, a2uiSurfaceSchema } from "./a2ui-contract";
import { distributionSchema } from "./a2ui-distribution";
export const SDK = "workbench-ui@2";
export const RUNTIME = "quickjs@0.32.0";
const scalar = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const binding = z.object({
  id: z.string(),
  datasetId: z.string(),
  op: z.enum(["field", "count", "groupCount", "sum", "distribution"]),
  field: z.string().optional(),
  rowId: z.string().optional(),
  seriesField: z.string().optional(),
  labelDatasetId: z.string().optional(),
  filter: z
    .array(z.object({ field: z.string(), op: z.literal("eq"), value: scalar }))
    .nullish(),
});
export const DynamicSchema = z.object({
  schemaVersion: z.literal(2),
  plan: z
    .object({
      title: z.string(),
      intent: z.string(),
      layout: z.enum(["stack", "main-sidebar", "columns"]),
      timeSensitive: z.boolean(),
      sections: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            role: z.enum(["primary", "secondary"]),
            surface: z.enum(["plain", "card", "muted"]).optional(),
          }),
        )
        .max(6),
    })
    .nullable(),
  datasets: z.record(
    z.string(),
    z.object({
      id: z.string(),
      query: z.object({ source: z.string() }).passthrough(),
      rows: z.array(z.record(z.string(), scalar)).max(1000),
      total: z.number(),
      complete: z.boolean(),
      nextOffset: z.number().nullable(),
    }),
  ),
  facts: z.record(
    z.string(),
    z.object({
      binding,
      value: z.union([
        scalar,
        z.record(z.string(), z.number()),
        distributionSchema,
      ]),
      complete: z.boolean(),
      evidenceIds: z.array(z.string()),
    }).refine(
      (f) =>
        (f.binding.op === "distribution") ===
        distributionSchema.safeParse(f.value).success,
      { message: "distribution_value_mismatch" },
    ),
  ),
  claims: z.record(
    z.string(),
    z.object({
      id: z.string(),
      kind: z.enum([
        "fact",
        "statement",
        "decision",
        "inference",
        "gap",
        "suggestion",
      ]),
      text: z.string().max(6000),
      evidenceIds: z.array(z.string()).nullable(),
      factIds: z.array(z.string()).nullable(),
      gapType: z.string().optional(),
    }),
  ),
  contents: z.record(
    z.string(),
    z.object({
      sectionId: z.string(),
      claims: z.array(z.unknown()).nullable(),
      facts: z.array(binding).nullable(),
      dataRefs: z.array(z.string()).nullable(),
    }),
  ),
  sections: z.record(
    z.string(),
    z.object({
      id: z.string(),
      revision: z.number(),
      code: z.string().max(32000),
      js: z.string().max(64000),
      hash: z.string(),
      sdk: z.string(),
      runtime: z.string(),
      state: z.record(
        z.string(),
        z.object({ default: scalar, values: z.array(scalar).max(30) }),
      ),
      contentRefs: z.array(z.string()).nullable(),
      dataRefs: z.array(z.string()).nullable(),
      fallback: z.string().optional(),
      compileMs: z.number(),
      surface: z.unknown().optional(),
    }).superRefine((section,ctx) => {
      if (section.sdk === A2UI_SDK) {
        if (section.code || section.js || Object.keys(section.state).length || section.runtime !== A2UI_RUNTIME || !a2uiSurfaceSchema.safeParse(section.surface).success)
          ctx.addIssue({code:"custom",message:"invalid_a2ui_section"});
      } else if (section.surface !== undefined && section.sdk !== "workbench-catalog@1") {
        ctx.addIssue({code:"custom",message:"unexpected_surface"});
      }
    }),
  ),
  complete: z.boolean(),
  seq: z.number(),
  attemptId: z.number(),
  limitations: z.array(z.string()),
  followUps: z.array(z.string()),
});
export type DynamicAnswer = z.infer<typeof DynamicSchema>;
export type DynamicSection = DynamicAnswer["sections"][string];
export const componentNames = [
  "Brief",
  "Panel",
  "Split",
  "Comparison",
  "Record",
  "CheckItem",
  "Feedback",
  "Box",
  "Stack",
  "Grid",
  "Divider",
  "Heading",
  "Text",
  "Badge",
  "Claim",
  "ClaimRef",
  "Fact",
  "Field",
  "Entity",
  "Evidence",
  "Table",
  "List",
  "Timeline",
  "BarChart",
  "Tabs",
  "Select",
  "Filter",
  "Toggle",
  "Collapse",
  "Action",
] as const;
export const propsSchema = z
  .object({
    id: z.string().max(200).optional(),
    datasetId: z.string().max(64).optional(),
    rowId: z.string().max(200).optional(),
    field: z.string().max(64).optional(),
    factId: z.string().max(64).optional(),
    gap: z.number().int().min(0).max(24).optional(),
    padding: z.number().int().min(0).max(24).optional(),
    columns: z.number().int().min(1).max(3).optional(),
    tone: z
      .enum(["neutral", "muted", "accent", "warning", "positive"])
      .optional(),
    surface: z.enum(["plain", "card", "muted"]).optional(),
    variant: z
      .enum([
        "default",
        "headline",
        "compact",
        "inline",
        "note",
        "badge",
        "value",
      ])
      .optional(),
    direction: z.enum(["row", "column"]).optional(),
    align: z.enum(["start", "center", "end"]).optional(),
    size: z.enum(["small", "normal", "large"]).optional(),
    label: z.string().max(150).optional(),
    description: z.string().max(180).optional(),
    fields: z.array(z.string().max(64)).max(6).optional(),
    rowIds: z.array(z.string().max(200)).max(80).optional(),
    stateKey: z.string().max(64).optional(),
    kind: z.enum(["followUp", "evidence"]).optional(),
    value: z.string().max(1000).optional(),
  })
  .strict();
export type TreeNode = {
  type: (typeof componentNames)[number];
  props: z.infer<typeof propsSchema>;
  children: (TreeNode | string)[];
};
const nodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z
    .object({
      type: z.enum(componentNames),
      props: propsSchema,
      children: z.array(z.union([z.string().max(300), nodeSchema])).max(200),
    })
    .strict(),
);
const allowed: Record<(typeof componentNames)[number], string[]> = {
  Brief: ["id", "label"],
  Panel: ["label", "description", "tone"],
  Split: [],
  Comparison: [],
  Record: ["datasetId", "rowId"],
  CheckItem: ["id", "label"],
  Feedback: ["datasetId", "rowIds"],
  Box: ["gap", "padding", "columns", "tone", "direction", "align", "surface"],
  Stack: ["gap", "padding", "columns", "tone", "direction", "align", "surface"],
  Grid: ["gap", "padding", "columns", "tone", "direction", "align", "surface"],
  Divider: [],
  Heading: ["tone", "size"],
  Text: ["tone", "size"],
  Badge: ["tone", "size"],
  Claim: ["id", "variant"],
  ClaimRef: ["id"],
  Fact: ["id", "label", "variant"],
  Field: ["datasetId", "rowId", "field", "label", "variant"],
  Entity: ["id", "variant"],
  Evidence: ["id"],
  Table: ["datasetId", "fields", "rowIds", "label", "variant"],
  List: ["datasetId", "fields", "rowIds", "label"],
  Timeline: ["datasetId", "fields", "rowIds", "label"],
  BarChart: ["factId", "label"],
  Tabs: ["stateKey", "label"],
  Select: ["stateKey", "label"],
  Filter: ["stateKey", "label"],
  Toggle: ["stateKey", "label"],
  Collapse: ["label"],
  Action: ["kind", "value", "label"],
};
export function validateTree(
  value: unknown,
  answer: DynamicAnswer,
  section: DynamicSection,
  evidenceIds: string[],
): TreeNode {
  let count = 0;
  const claims = new Set<string>();
  const inspect = (v: unknown, depth: number): void => {
    if (depth > 32 || ++count > 2000) throw Error("tree_limit");
    if (typeof v === "string") {
      if (v.length > 300) throw Error("text_limit");
      return;
    }
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw Error("invalid_node");
    for (const [k, x] of Object.entries(v)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw Error("prototype_key");
      if (k === "children") {
        if (!Array.isArray(x)) throw Error("invalid_children");
        for (const c of x) inspect(c, depth + 1);
      }
      if (k === "props" && x && typeof x === "object") {
        for (const key of Object.keys(x)) {
          if (["__proto__", "constructor", "prototype"].includes(key))
            throw Error("prototype_key");
        }
      }
    }
  };
  if (JSON.stringify(value).length > 512 * 1024) throw Error("output_limit");
  inspect(value, 0);
  const tree = nodeSchema.parse(value);
  const visit = (n: TreeNode) => {
    const p = n.props;
    if (Object.keys(p).some((k) => !allowed[n.type].includes(k)))
      throw Error("invalid_props");
    const variants: Partial<Record<TreeNode["type"], string[]>> = {
      Claim: ["default", "headline", "compact", "inline", "note"],
      Fact: ["default", "inline", "value"],
      Field: ["default", "inline", "value", "badge"],
      Entity: ["default", "inline"],
      Table: ["default", "compact"],
    };
    if (p.variant && !variants[n.type]?.includes(p.variant))
      throw Error("invalid_variant");
    if (["Text", "Heading", "Badge"].includes(n.type)) {
      const inline = (child: TreeNode): boolean => {
        if (["Text", "Heading", "Badge"].includes(child.type))
          return (
            child.type === "Badge" &&
            child.children.every((c) => typeof c === "string" || inline(c))
          );
        if (child.type === "Field") return true;
        return (
          ["Fact", "Entity", "Claim"].includes(child.type) &&
          child.props.variant === "inline"
        );
      };
      if (n.children.some((c) => typeof c !== "string" && !inline(c)))
        throw Error("block_in_text");
    }
    if (
      n.children.some((c) => typeof c === "string") &&
      !["Text", "Heading", "Badge"].includes(n.type)
    )
      throw Error("unbound_text");
    if (["Claim", "ClaimRef", "Brief", "CheckItem"].includes(n.type)) {
      if (!p.id || !section.contentRefs?.includes(p.id) || !answer.claims[p.id])
        throw Error("unknown_claim");
      if (n.type !== "ClaimRef") {
        if (claims.has(p.id)) throw Error("duplicate_claim");
        claims.add(p.id);
      }
    }
    if (n.type === "Fact" && (!p.id || !answer.facts[p.id]))
      throw Error("unknown_fact");
    if (
      n.type === "BarChart" &&
      (!p.factId || answer.facts[p.factId]?.binding.op !== "groupCount")
    )
      throw Error("invalid_chart");
    if (
      ["Entity", "Evidence"].includes(n.type) &&
      (!p.id || !evidenceIds.includes(p.id))
    )
      throw Error("unknown_evidence");
    if (["Table", "List", "Timeline", "Field", "Record", "Feedback"].includes(n.type)) {
      const ds = p.datasetId && answer.datasets[p.datasetId];
      if (!ds || !section.dataRefs?.includes(ds.id))
        throw Error("unknown_dataset");
      if (p.rowIds?.some((id) => !ds.rows.some((r) => r.id === id)))
        throw Error("unknown_row");
      if (
        n.type === "Field" &&
        (!p.rowId ||
          !p.field ||
          !ds.rows.some((r) => r.id === p.rowId && Object.hasOwn(r, p.field!)))
      )
        throw Error("unknown_field");
      if (
        ["Table", "List", "Timeline"].includes(n.type) &&
        (!p.fields?.length ||
          p.fields.some(
            (f) =>
              ds.rows.length > 0 && !ds.rows.some((r) => Object.hasOwn(r, f)),
          ))
      )
        throw Error("unknown_column");
    }
    if (n.type === "Record") {
      const ds = answer.datasets[p.datasetId || ""];
      if (!ds?.rows.some((r) => r.id === p.rowId && r.kind === "issue")) throw Error("invalid_record");
    }
    if (n.type === "Feedback") {
      const rows = answer.datasets[p.datasetId || ""]?.rows || [];
      if (rows.some((r) => (!p.rowIds || p.rowIds.includes(String(r.id))) && !["comment", "topic"].includes(String(r.kind)))) throw Error("invalid_feedback");
    }
    if (n.type === "Split" && n.children.length !== 2) throw Error("invalid_split");
    if (n.type === "Comparison" && n.children.some((c) => typeof c === "string" || !["Record", "CheckItem"].includes(c.type))) throw Error("invalid_comparison");
    if (n.type === "CheckItem" && !["gap", "suggestion"].includes(answer.claims[p.id || ""]?.kind)) throw Error("invalid_check");
    if (
      ["Tabs", "Select", "Filter", "Toggle"].includes(n.type) &&
      (!p.stateKey || !section.state[p.stateKey])
    )
      throw Error("undeclared_state");
    if (
      n.type === "Action" &&
      (!p.kind ||
        !p.value ||
        !p.label ||
        (p.kind === "evidence" && !evidenceIds.includes(p.value)))
    )
      throw Error("invalid_action");
    for (const child of n.children) if (typeof child !== "string") visit(child);
  };
  visit(tree);
  if (section.contentRefs?.some((id) => !claims.has(id)))
    throw Error("missing_claim");
  return tree;
}
