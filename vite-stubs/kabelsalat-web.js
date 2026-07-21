// Stub for @kabelsalat/web (a WebAudio synth REPL). @strudel/core's repl.mjs
// imports { SalatRepl } at module load but only instantiates it inside repl(),
// which we never call (we transpile + query patterns headless, no audio). This
// stub lets @strudel/core load in Node/Workers so we can run the REAL Strudel
// engine server-side to validate generated code. Aliased in via wrangler/vite.
export class SalatRepl {
  constructor() {}
  setCode() {}
  evaluate() {}
  stop() {}
}
export default { SalatRepl };
