import { z } from "zod";
import { componentNames, propsSchema, validateTree, type DynamicAnswer, type DynamicSection, type TreeNode } from "./dynamic-contract";

export const CATALOG_ID = "https://mobilework.local/catalog/answer/v1";
export const SURFACE_SDK = "workbench-catalog@1";
const componentId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
export const surfaceSchema = z.object({
  catalogId: z.literal(CATALOG_ID),
  components: z.array(z.object({
    id: componentId,
    component: z.enum(componentNames),
    props: propsSchema,
    children: z.array(componentId).max(80).default([]),
  }).strict()).min(1).max(120),
}).strict();

// Read-only compatibility for the pre-A2UI experiment. New answers use A2uiSurface.
export function createCatalogSurface(raw: unknown) {
  const definition = surfaceSchema.parse(raw);
  const nodes = new Map(definition.components.map((c) => [c.id, c]));
  if (nodes.size !== definition.components.length || !nodes.has("root")) throw Error("invalid_surface_root");
  const visited = new Set<string>();
  const build = (id: string, depth: number): TreeNode => {
    const c = nodes.get(id);
    if (!c || visited.has(id) || depth > 16) throw Error("invalid_surface_graph");
    visited.add(id);
    return { type: c.component, props: c.props, children: c.children.map((child) => build(child, depth + 1)) };
  };
  const tree = build("root", 0);
  if (visited.size !== nodes.size) throw Error("unreachable_surface_component");
  return {
    tree,
    update(answer: DynamicAnswer, section: DynamicSection, evidenceIds: string[]) {
      validateTree(tree, answer, section, evidenceIds);
      return answer;
    },
    dispose: () => {},
  };
}
