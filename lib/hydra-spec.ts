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
- \`shape(sides, radius, smooth)\` · \`gradient(0)\` · \`solid(r,g,b,a)\` · \`src(o0)\` (o0 = last frame, for feedback) · \`prev()\` (this output's last frame)

TRANSFORMS — METHODS, chained onto a source (NEVER called bare):
- geometry: \`.rotate(a)\` \`.scale(a)\` \`.scrollX(x)\` \`.scrollY(y)\` \`.pixelate(x,y)\` \`.repeat(x,y)\` \`.repeatX(n)\` \`.repeatY(n)\` \`.scroll(x,y)\` \`.kaleid(n)\`
- colour: \`.color(r,g,b)\` \`.hue(a)\` \`.saturate(a)\` \`.colorama(a)\` \`.contrast(a)\` \`.brightness(a)\` \`.luma(t)\` \`.thresh(t)\` \`.invert()\` \`.posterize(n)\` \`.shift(r,g,b)\` \`.r()\` \`.g()\` \`.b()\` \`.a()\` \`.sum()\`
- blend (arg = ANOTHER source): \`.add(src,amt)\` \`.sub(src)\` \`.mult(src)\` \`.blend(src,amt)\` \`.diff(src)\` \`.mask(src)\` \`.layer(src)\`
- modulate (1st arg = a source; warps by its brightness): \`.modulate(src,amt)\` \`.modulateScale(src,amt)\` \`.modulateRotate(src,amt)\` \`.modulateHue\` \`.modulatePixelate\` \`.modulateScrollX/Y\` \`.modulateRepeat/X/Y\` \`.modulateKaleid\`
- output: \`.out()\` / \`.out(o1)\`  (o0..o3; \`render(o1)\` picks which one the screen shows)

PARAMS — any number slot also takes: a FUNCTION \`() => 0.4 + wob()\`, an ARRAY \`[3,6,9].fast(2)\` (also .slow .smooth .ease .offset .fit), or a whole CHAIN (read as its brightness: \`.rotate(noise(3))\`).

HARD RULES:
- NO \`blur\`/\`glow\`/\`bloom\`/\`feedback\`/\`filter\` — they don't exist and CRASH the visual.
- Blend/transform are METHODS: \`source.diff(other)\`, NEVER bare \`diff(...)\` → "diff is not defined". Only SOURCES and \`H()\` are standalone.
- \`.out()\` ENDS a chain — nothing may follow it.

SYNC TO THE MUSIC — \`H(signal)\` samples a Strudel pattern on the transport clock:
- Motion wants a CONTINUOUS signal: \`saw|sine|tri|perlin\` + \`.slow(n)\`/\`.fast(n)\`/\`.range(a,b)\`.
- Mini-notation works too and SNAPS — right for steps and section gates, wrong for smooth motion: \`H("<6 8 12 16>")\`, \`H("<0!8 1!8>")\`.
- WRAP-around params (\`.rotate\` \`.hue\` \`.scroll*\`): use \`H(saw…)\` — the 0→reset is invisible (2π == 0, 1 == 0).
- EASE params (\`.scale\` \`.brightness\` \`.modulate\` amounts): use \`H(sine…)\`/\`H(tri…)\`.

LOOP IN LOCKSTEP (the music loop is N cycles — return to the start every N cycles):
- Every \`H()\` period must DIVIDE N: \`.slow(N)\` (1×/loop), \`.slow(N/2)\` (2×), \`.slow(1)\` (every cycle). NEVER a period like \`.slow(8)\` under a 5-cycle loop — it won't come home.
- FREEZE Hydra's own clocks (they run on wall-time, never loop): \`osc\` sync, \`noise\`/\`voronoi\` speed all DEFAULT NONZERO → pass 0 explicitly (\`osc(4,0,1)\`, \`noise(2,0)\`, \`voronoi(3,0)\`); \`gradient(0)\`; no speed on \`scroll*\`. ALL motion comes from \`H()\`, none from Hydra time.`;
