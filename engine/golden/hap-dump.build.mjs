import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
await build({
  entryPoints: [here("./hap-dump.src.mjs")],
  bundle: true, format: "esm", platform: "node",
  outfile: here("./hap-dump.mjs"),
  alias: { "@kabelsalat/web": here("../../vite-stubs/kabelsalat-web.js") },
  logLevel: "error",
});
console.log("hap-dump bundled");
