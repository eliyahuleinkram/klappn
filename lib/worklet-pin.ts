/* AudioWorklet processor-constructor PIN — userspace fix for WebKit bug 279537 / 278512.
 *
 * THE BUG (Safari 18.0 / 18.0.1 only; macOS 15.0.x):
 *   WebKit holds each registered AudioWorkletProcessor constructor behind a WEAK handle
 *   (`JSCallbackData::m_callback` is a `JSC::Weak<JSObject>`, regressed 280975@main), and
 *   `AudioWorkletGlobalScope::visitProcessors` marks only live *instances*. superdough ships
 *   its worklets as one minified IIFE, so the moment that module finishes evaluating, all 15
 *   processor CLASSES are unreachable from JS — WebKit's weak handle is the only reference.
 *
 *   A GC pass on the worklet VM during playback then reaps any processor class that has no
 *   live instance. Play a crush/shape loop for a few seconds and `supersaw-oscillator` — which
 *   that loop never instantiates — gets collected. The next `new AudioWorkletNode(ac,
 *   'supersaw-oscillator')` passes the main-thread guard (BaseAudioContext's parameter-descriptor
 *   map is add-only and still holds the name), dispatches to the audio thread, and there
 *   `constructor->callbackData()->callback()` returns nullptr. 18.0.x does not null-check it, so
 *   `JSC::construct(null)` reads JSCell::m_type at offset 5 off a null pointer → SIGSEGV on the
 *   "WebCore: AudioWorklet" thread → the whole tab dies ("a problem repeatedly occurred").
 *
 * THE FIX:
 *   Wrap `registerProcessor` inside the AudioWorkletGlobalScope, BEFORE any other worklet module
 *   loads, and keep every registered class in an array on the worklet global — which is a GC root.
 *   The constructors then survive collection and `callback()` can never return null. This is, in
 *   effect, what Safari 18.1 started doing internally (opaque-root retention, 282644@main).
 *
 * WHY SHIP IT ANYWAY:
 *   - Safari 18.1 fixes retention; 18.2 adds the null-check (283510@main). On 18.2 WITHOUT the
 *     pin the crash merely becomes a SILENT DEAD VOICE (processor set to null) — so the pin is
 *     strictly better than relying on the upstream null-check.
 *   - Chrome/Blink keeps constructors strongly (`HeapHashMap<String, Member<...>>`), so this is
 *     an inert no-op there, as it is on any fixed Safari. Cost: 15 class objects retained, a few KB.
 *   - It pins CONSTRUCTORS, never instances — processor instances are still freed normally.
 *
 * ORDERING IS LOAD-BEARING: this module must be the FIRST `addModule` on the context, because it
 * works by wrapping `registerProcessor`. Once superdough's module has evaluated there is nothing
 * left to wrap. See the call site in lib/strudel-client.ts (ensureStarted).
 */

/** Runs INSIDE the AudioWorkletGlobalScope. Kept ASCII so `btoa` can encode it. */
const PIN_SOURCE = `"use strict";
(() => {
  const g = globalThis;
  if (g.__wp) return;                       // idempotent: never wrap twice
  const orig = g.registerProcessor;
  if (typeof orig !== "function") return;   // not an AudioWorkletGlobalScope — nothing to do
  const pinned = (g.__wp = []);             // the GC root: every processor class, forever
  const names = (g.__wpn = []);             // parallel list of names, for diagnostics only
  const wrapped = function (name, ctor) {
    // Worklet modules are always strict, so a bare registerProcessor(...) call would pass
    // this === undefined to a [Global] operation. Re-bind the receiver explicitly.
    const result = orig.call(g, name, ctor);
    pinned.push(ctor);                      // pin only AFTER the registration actually succeeded,
    names.push(name);                       // so a duplicate-name throw leaves nothing retained
    return result;
  };
  try {
    g.registerProcessor = wrapped;
  } catch (e) {
    try {
      Object.defineProperty(g, "registerProcessor", {
        value: wrapped, configurable: true, writable: true,
      });
    } catch (e2) {
      return;                               // cannot install; boot proceeds exactly as before
    }
  }
  // Lets the main thread confirm the pin actually took (see readPinnedProcessors). Registered
  // THROUGH the wrapper so this class is pinned too — an unpinned class is exactly what crashes
  // 18.0.x, and this one is constructed on demand long after boot.
  class WpReport extends AudioWorkletProcessor {
    constructor() {
      super();
      this.port.postMessage(names.slice());
    }
    process() {
      return false;                         // never renders; freed right after construction
    }
  }
  wrapped("wp-report", WpReport);
})();
`;

/** Name of the reporter processor registered by PIN_SOURCE. */
const REPORT_PROCESSOR = "wp-report";

/** In-flight + completed dedupe, keyed by the context's own AudioWorklet.
 *  NB: unlike superdough's `loadWorklets()`, this latch is NEVER cleared on success —
 *  a self-erasing guard would re-`addModule` and re-evaluate the module. */
const pinning = new WeakMap<AudioWorklet, Promise<void>>();

function dataUrl(source: string): string {
  return `data:text/javascript;base64,${btoa(source)}`;
}

async function installPin(worklet: AudioWorklet): Promise<void> {
  try {
    await worklet.addModule(dataUrl(PIN_SOURCE));
    return;
  } catch {
    // Some engines / CSPs refuse `data:` worklet modules. (superdough itself ships its worklets
    // as a data: URL, so this path is belt-and-braces.) Fall back to a blob URL.
  }
  const url = URL.createObjectURL(new Blob([PIN_SOURCE], { type: "text/javascript" }));
  try {
    await worklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Pin every AudioWorkletProcessor constructor registered on `ac` against premature GC.
 *  Best-effort and idempotent: on any failure we land exactly where we were without it.
 *  MUST be awaited before the first worklet module loads on this context. */
export function pinWorkletConstructors(ac: AudioContext | null | undefined): Promise<void> {
  const worklet = ac?.audioWorklet;
  // Browsers with no AudioWorklet at all (Safari < 14.1): nothing to pin, and superdough's own
  // loadWorklets() will no-op/throw-and-be-caught the same way it does today.
  if (!worklet || typeof worklet.addModule !== "function") return Promise.resolve();
  let p = pinning.get(worklet);
  if (!p) {
    p = installPin(worklet).catch((e) => {
      console.error("[klappn] worklet constructor pin failed", e);
    });
    pinning.set(worklet, p);
  }
  return p;
}

/** Diagnostics: the names of every processor class the pin is holding, read straight out of the
 *  worklet scope. Expect 17 — superdough's 15, @strudel/web's `dough-processor` (registered as an
 *  external worklet), and `wp-report` itself. Constructing the reporter is safe on Safari 18.0.x
 *  precisely because it is itself pinned.
 *
 *  Call it while audio is PLAYING: processor construction is a task on the worklet run loop, so a
 *  suspended context may never build the reporter and this resolves `null` on the timeout. `null`
 *  therefore means "pin not confirmed" (never installed, or context idle) — never "pin is broken". */
export function readPinnedProcessors(
  ac: AudioContext | null | undefined,
): Promise<string[] | null> {
  return new Promise((resolve) => {
    if (!ac) return resolve(null);
    let node: AudioWorkletNode;
    try {
      node = new AudioWorkletNode(ac, REPORT_PROCESSOR);
    } catch {
      return resolve(null); // pin module never evaluated → name was never registered
    }
    const timer = setTimeout(() => {
      // A suspended/idle context may never construct the reporter (worklet
      // tasks only run while rendering). Detach the handler so the node and
      // this closure can be GC'd instead of idling for the session — repeated
      // diagnostics calls otherwise accumulate live AudioWorkletNodes.
      node.port.onmessage = null;
      resolve(null);
    }, 2000);
    node.port.onmessage = (e: MessageEvent) => {
      clearTimeout(timer);
      node.disconnect();
      resolve(Array.isArray(e.data) ? (e.data as string[]) : null);
    };
  });
}
