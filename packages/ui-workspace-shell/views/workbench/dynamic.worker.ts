import { newQuickJSWASMModule, newVariant } from "quickjs-emscripten";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import wasmURL from "@jitl/quickjs-wasmfile-release-sync/wasm?url";
import { evaluateLayout } from "./dynamic-vm";
const began = performance.now();
const engine = newQuickJSWASMModule(
  newVariant(variant, { wasmLocation: wasmURL }),
);
self.onmessage = async (
  event: MessageEvent<{ js: string; input: unknown }>,
) => {
  try {
    const ready = await engine;
    const initialized = performance.now();
    const result = evaluateLayout(ready, event.data.js, event.data.input);
    self.postMessage({ ok: true, ...result, initMs: initialized - began });
  } catch {
    self.postMessage({ ok: false, error: "layout_runtime_error" });
  }
};
