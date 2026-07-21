/**
 * Hydra API reference — the concise twin of STRUDEL_SPEC. Appended to the Hydra
 * prompt (withHydraSpec) so a model that doesn't have the hydra-synth dialect baked
 * in writes only REAL functions, wired correctly, and looping in lockstep with the
 * music. Deliberately tiny — every line earns its place.
 */
export const HYDRA_SPEC = `# Hydra — Visual Spec (the loop's reactive backdrop)

Hydra is already initialised; \`H()\` and the Strudel signals (saw sine tri perlin) are in scope. Write ONE chain — a SOURCE, then transforms — ENDING in \`.out()\`. Output RAW code only, no comments/prose. Use ONLY what's below; nothing else exists.

SHAPE:
\`osc(4, 0, 1).rotate(H(saw.slow(8).range(0, 6.283))).color(1, .6, .3).kaleid(6).out()\`

SOURCES — the ONLY functions written standalone:
- \`osc(freq, sync=0, offset)\` — stripes/rings. **sync MUST be 0** (see LOOP).
- \`noise(scale, speed=0)\` — perlin field. **speed MUST be 0.**
- \`voronoi(scale, speed=0, blend)\` — cells. **speed MUST be 0.**
- \`shape(sides, radius, smooth)\` · \`gradient(0)\` · \`solid(r,g,b,a)\` · \`src(o0)\` (o0 = last frame, for feedback)

TRANSFORMS — METHODS, chained onto a source (NEVER called bare):
- geometry: \`.rotate(a)\` \`.scale(a)\` \`.scrollX(x)\` \`.scrollY(y)\` \`.pixelate(x,y)\` \`.repeat(x,y)\` \`.kaleid(n)\`
- colour: \`.color(r,g,b)\` \`.hue(a)\` \`.saturate(a)\` \`.colorama(a)\` \`.contrast(a)\` \`.brightness(a)\` \`.luma(t)\` \`.thresh(t)\` \`.invert()\` \`.posterize(n)\`
- blend (arg = ANOTHER source): \`.add(src,amt)\` \`.sub(src)\` \`.mult(src)\` \`.blend(src,amt)\` \`.diff(src)\` \`.mask(src)\` \`.layer(src)\`
- modulate (1st arg = a source; warps by its brightness): \`.modulate(src,amt)\` \`.modulateScale(src,amt)\` \`.modulateRotate(src,amt)\` \`.modulateHue\` \`.modulatePixelate\` \`.modulateScrollX/Y\` \`.modulateKaleid\`
- output: \`.out()\`  (routes to the screen, o0)

HARD RULES:
- NO \`blur\`/\`glow\`/\`bloom\`/\`feedback\`/\`filter\` — they don't exist and CRASH the visual.
- Blend/transform are METHODS: \`source.diff(other)\`, NEVER bare \`diff(...)\` → "diff is not defined". Only SOURCES and \`H()\` are standalone.

SYNC TO THE MUSIC — \`H(signal)\` samples a Strudel signal on the transport clock:
- ALWAYS a CONTINUOUS signal: \`saw|sine|tri|perlin\` + \`.slow(n)\`/\`.fast(n)\`/\`.range(a,b)\`. NEVER \`H("0 1 2")\` — a string SNAPS (jerky).
- WRAP-around params (\`.rotate\` \`.hue\` \`.scroll*\`): use \`H(saw…)\` — the 0→reset is invisible (2π == 0, 1 == 0).
- EASE params (\`.scale\` \`.brightness\` \`.modulate\` amounts): use \`H(sine…)\`/\`H(tri…)\`.

LOOP IN LOCKSTEP (the music loop is N cycles — return to the start every N cycles):
- Every \`H()\` period must DIVIDE N: \`.slow(N)\` (1×/loop), \`.slow(N/2)\` (2×), \`.slow(1)\` (every cycle). NEVER a period like \`.slow(8)\` under a 5-cycle loop — it won't come home.
- FREEZE Hydra's own clocks (they run on wall-time, never loop): \`osc\` sync, \`noise\`/\`voronoi\` speed all DEFAULT NONZERO → pass 0 explicitly (\`osc(4,0,1)\`, \`noise(2,0)\`, \`voronoi(3,0)\`); \`gradient(0)\`; no speed on \`scroll*\`. ALL motion comes from \`H()\`, none from Hydra time.`;
