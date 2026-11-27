import LayoutWorker from "./dynamic.worker?worker&inline";
import { createCatalogSurface, SURFACE_SDK } from "./catalog-surface";
import { z } from "zod";
import {
  validateTree,
  SDK,
  RUNTIME,
  type DynamicAnswer,
  type DynamicSection,
  type TreeNode,
} from "./dynamic-contract";
const response = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    tree: z.unknown(),
    evalMs: z.number(),
    initMs: z.number(),
  }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export function runLayout(
  answer: DynamicAnswer,
  section: DynamicSection,
  state: Record<string, unknown>,
  asOf: string,
  evidenceIds: string[],
  signal: AbortSignal,
  createWorker = () =>
    new LayoutWorker(),
): Promise<{
  tree: TreeNode;
  evalMs: number;
  initMs: number;
  totalMs: number;
}> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(Error("aborted"));
      return;
    }
    if (section.surface !== undefined && section.sdk === SURFACE_SDK) {
      const start = performance.now();
      try {
        const surface = createCatalogSurface(section.surface);
        try {
          surface.update(answer, section, evidenceIds);
          resolve({ tree: surface.tree, evalMs: 0, initMs: 0, totalMs: performance.now() - start });
        } finally { surface.dispose(); }
      } catch (error) { reject(error); }
      return;
    }
    if (
      section.sdk !== SDK ||
      section.runtime !== RUNTIME ||
      section.fallback
    ) {
      reject(Error("incompatible_layout"));
      return;
    }
    for (const [key, value] of Object.entries(state))
      if (!section.state[key]?.values.some((allowed) => allowed === value)) {
        reject(Error("undeclared_state"));
        return;
      }
    const started = performance.now();
    const worker = createWorker();
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(Error("aborted"));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(Error("layout_watchdog"));
    }, 2000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(Error("worker_error"));
    };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      cleanup();
      try {
        const r = response.parse(event.data);
        if (!r.ok) throw Error(r.error);
        resolve({
          tree: validateTree(r.tree, answer, section, evidenceIds),
          evalMs: r.evalMs,
          initMs: r.initMs,
          totalMs: performance.now() - started,
        });
      } catch (e) {
        reject(e);
      }
    };
    const data = Object.fromEntries(
      (section.dataRefs || []).map((id) => [
        id,
        answer.datasets[id]?.rows || [],
      ]),
    );
    worker.postMessage({
      js: section.js,
      input: { data, facts: answer.facts, claims: answer.claims, state, asOf },
    });
  });
}
