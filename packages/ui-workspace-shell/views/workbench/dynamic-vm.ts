import type { QuickJSWASMModule } from "quickjs-emscripten";
import { componentNames } from "./dynamic-contract";
export function evaluateLayout(
  engine: QuickJSWASMModule,
  js: string,
  input: unknown,
): { tree: unknown; evalMs: number } {
  if (js.length > 64000 || JSON.stringify(input).length > 1024 * 1024)
    throw Error("input_limit");
  const start = performance.now();
  const runtime = engine.newRuntime();
  runtime.setMemoryLimit(16 * 1024 * 1024);
  runtime.setMaxStackSize(256 * 1024);
  runtime.setInterruptHandler(() => performance.now() - start > 100);
  const vm = runtime.newContext();
  try {
    const source = `"use strict"; globalThis.Date=undefined; Math.random=undefined;
      const input=${JSON.stringify(input)};
      const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o)};return o};freeze(input);
      const ui=Object.freeze({...Object.fromEntries(${JSON.stringify(componentNames)}.map(x=>[x,x])),Fragment:'Stack',h:(type,props,...children)=>{const {key,...safe}=props||{};return {type,props:safe,children:children.flat(Infinity).filter(x=>x!==null&&x!==undefined&&x!==false)}}});
      ${js}\nconst serialized=JSON.stringify(render(input,ui));if(typeof serialized!=='string'||serialized.length>524288)throw Error('output_limit');serialized;`;
    const result = vm.evalCode(source, "layout.js");
    if (result.error) {
      result.error.dispose();
      throw Error("layout_runtime_error");
    }
    try {
      const raw = vm.getString(result.value);
      return { tree: JSON.parse(raw), evalMs: performance.now() - start };
    } finally {
      result.value.dispose();
    }
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
