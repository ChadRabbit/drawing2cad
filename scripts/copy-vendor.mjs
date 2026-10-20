// Copies the STEP reader (OpenCascade compiled to WebAssembly) into public/ so the browser can load it
// without bundling. Runs before dev and build.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor/occt", { recursive: true });
for (const f of ["occt-import-js.js", "occt-import-js.wasm", "occt-import-js-worker.js"]) {
  cpSync(`node_modules/occt-import-js/dist/${f}`, `public/vendor/occt/${f}`);
}
