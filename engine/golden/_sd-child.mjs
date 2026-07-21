
import { renderLoop } from "../../render-service/dist/engine.mjs";
const code = process.env.CODE;
const out = await renderLoop(code, { cycles: Number(process.env.CYCLES || 1), wrapTail: false, limiter: false, format: "float32", tailSec: 0.6 });
process.stdout.write(Buffer.from(out.audio));
process.exit(0);
