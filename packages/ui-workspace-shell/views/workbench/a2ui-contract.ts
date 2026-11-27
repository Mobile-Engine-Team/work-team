import { z } from "zod";
import { Catalog } from "@a2ui/web_core/catalog";
import document from "./answer-catalog.json";
import type { DynamicAnswer, DynamicSection } from "./dynamic-contract";
import { distributionSchema } from "./a2ui-distribution";
export const A2UI_SDK = "workbench-a2ui@1";
export const A2UI_RUNTIME = "a2ui@1.0/react@0.15.0";
export const a2uiCatalog = Catalog.fromJson(document);
const componentId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
export const a2uiSurfaceSchema = z
  .object({
    catalogId: z.literal(document.catalogId),
    components: z
      .array(
        z
          .object({ id: componentId, component: z.string() })
          .catchall(z.unknown()),
      )
      .min(1)
      .max(120),
  })
  .strict();
export type SurfaceDefinition = z.infer<typeof a2uiSurfaceSchema>;
export function a2uiData(answer: DynamicAnswer, section: DynamicSection) {
  const records: Record<string, Record<string, Record<string, unknown>>> = {};
  const collections: Record<string, Record<string, unknown>[]> = {};
  for (const id of section.dataRefs || []) {
    const ds = answer.datasets[id];
    if (!ds) throw Error("unknown_dataset");
    records[id] = Object.fromEntries(
      ds.rows.map((row) => [String(row.id), row]),
    );
    collections[id] = ds.rows;
  }
  const claims = Object.fromEntries(
    (section.contentRefs || []).map((id) => {
      if (!answer.claims[id]) throw Error("unknown_claim");
      return [id, answer.claims[id]];
    }),
  );
  const facts = Object.fromEntries(
    (answer.contents[section.id]?.facts || []).map((b) => {
      if (!answer.facts[b.id]) throw Error("unknown_fact");
      return [b.id, answer.facts[b.id]];
    }),
  );
  return { records, collections, claims, facts };
}
// Properties whose values must be canonical server-normalized bindings.
const TRUSTED = ["text", "rows", "value", "evidenceIds", "factIds", "data"];
// `data` is only read through JSON pointers, so any snapshot shape is accepted.
export function validateA2ui(raw: unknown, data: unknown) {
  const definition = a2uiSurfaceSchema.parse(raw);
  const nodes = new Map(definition.components.map((n) => [n.id, n]));
  if (nodes.size !== definition.components.length)
    throw Error("duplicate_component");
  const pointer = (path: string): unknown => {
    let value: unknown = data;
    if (!path.startsWith("/")) throw Error("absolute_path_required");
    for (const p of path.slice(1).split("/")) {
      const key = p.replaceAll("~1", "/").replaceAll("~0", "~");
      if (!value || typeof value !== "object" || !Object.hasOwn(value, key))
        throw Error("unknown_binding");
      value = Reflect.get(value, key);
    }
    return value;
  };
  const visitValue = (v: unknown, key: string): void => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (Object.hasOwn(v, "@path")) {
        const path = z.object({ "@path": z.string() }).strict().parse(v)[
          "@path"
        ];
        const patterns: Record<string, RegExp> = {
          rows: /^\/collections\/[^/]+$/,
          value: /^\/(records\/[^/]+\/[^/]+\/[^/]+|facts\/[^/]+\/value)$/,
          text: /^\/claims\/[^/]+\/text$/,
          evidenceIds: /^\/claims\/[^/]+\/evidenceIds$/,
          factIds: /^\/claims\/[^/]+\/factIds$/,
          data: /^\/facts\/[^/]+\/value$/,
        };
        if (!patterns[key]?.test(path)) throw Error("out_of_scope_binding");
        const resolved = pointer(path);
        if (key === "text" && typeof resolved !== "string")
          throw Error("invalid_text_binding");
        if (
          ["rows", "evidenceIds", "factIds"].includes(key) &&
          !Array.isArray(resolved)
        )
          throw Error("invalid_array_binding");
        if (key === "data" && !distributionSchema.safeParse(resolved).success)
          throw Error("invalid_distribution_binding");
        if (key === "value" && distributionSchema.safeParse(resolved).success)
          throw Error("distribution_requires_data");
        return;
      }
      if (TRUSTED.includes(key)) throw Error("trusted_binding_required");
      for (const [k, x] of Object.entries(v)) {
        if (
          [
            "__proto__",
            "constructor",
            "prototype",
            "@call",
            "call",
            "path",
          ].includes(k)
        )
          throw Error("forbidden_property");
        visitValue(x, k);
      }
    } else if (Array.isArray(v) && !TRUSTED.includes(key))
      v.forEach((x) => visitValue(x, key));
    else if (TRUSTED.includes(key)) throw Error("trusted_binding_required");
  };
  for (const node of definition.components) {
    const api = a2uiCatalog.components.get(node.component);
    if (!api) throw Error("unknown_component");
    const { id: _id, component: _component, ...props } = node;
    api.schema.parse(props);
    // The app boundary accepts only canonical, server-normalized bindings.
    visitValue(props, "");
  }
  const seen = new Set<string>();
  const walk = (id: string, depth: number) => {
    const n = nodes.get(id);
    if (!n || seen.has(id) || depth > 12) throw Error("invalid_graph");
    seen.add(id);
    if (n.children !== undefined)
      z.array(componentId)
        .max(80)
        .parse(n.children)
        .forEach((c) => walk(c, depth + 1));
  };
  walk("root", 0);
  if (seen.size !== nodes.size) throw Error("unreachable_components");
  return definition;
}

/** Presentation follows the actual components, without a separate intent route. */
export function isProseAnswer(answer: DynamicAnswer): boolean {
  const sections = Object.values(answer.sections);
  return sections.length > 0 && sections.every((section) => {
    const parsed = a2uiSurfaceSchema.safeParse(section.surface);
    return section.sdk === A2UI_SDK && parsed.success &&
      parsed.data.components.some((node) => node.component === "Prose") &&
      parsed.data.components.every((node) =>
        ["Prose", "Stack", "Section", "Split", "Grid", "Disclosure"].includes(node.component));
  }) && Object.keys(answer.datasets).length === 0;
}
