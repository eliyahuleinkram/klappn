/**
 * Strudel API reference — appended (withSpec) by the strudelize path, which
 * turns a plain-music score into code and leans on the spec for syntax. The
 * direct-Strudel compose path sends no reference: the model knows the dialect.
 */
export const STRUDEL_SPEC = `# Strudel — Parameter Spec (for writing instrumental loops)

Strudel is the JavaScript port of **TidalCycles** — same pattern language and mini-notation, same control names (gain, lpf/cutoff, resonance, room, delay, speed, pan, shape, crush, coarse, vowel, begin/end…), same value conventions and idioms. **LEAN on your TidalCycles knowledge** for which methods exist, what their parameters mean and their sensible ranges (e.g. \`gain\` ~0–1.2, \`pan\` 0–1, \`cutoff\`/\`lpf\` in Hz, \`speed\` as a playback-rate multiplier, \`shape\`/\`crush\` distortion). The differences from Tidal: it's method-chained JS (\`.lpf(900)\`, not \`# lpf 900\`), and you must use ONLY sounds already in the loop, gm_/bank names, and the standard oscillators. This file documents the JS syntax + the available controls and is authoritative where it and your memory disagree — follow it exactly and never invent functions or sound names.

Song shape: \`setcpm(BPM/BEATS)\` first (BEATS = the time signature's beats-per-bar — 4 for 4/4, 3 for 3/4, 7 for 7/8), then **one \`$:\` line per simultaneous part** (any number of parts, any instruments — drums, melodic, or both). Each line is \`pattern.method().control()…\`. \`_$:\` mutes a line. \`hush()\` stops all.

\`\`\`js
setcpm(110/4)
$: s("bd*4, hh*8")
$: n("0 3 5 7").scale("C3:minor").s("sawtooth").lpf(900).clip(.7).gain(.5).room(.4)
\`\`\`

Keep melodic lines as \`.s(...).clip(...).gain(...).room(...)\`. Keep all parts in one key.

Notation in this doc: \`name(arg)\` — **type · range/units · default** — meaning. Any numeric arg can also be a pattern string (e.g. \`lpf("200 2000")\`). Aliases in parens.

---

## TIMING — READ FIRST (the #1 source of mistakes)
- \`setcpm(BPM/BEATS)\` sets tempo: **1 CYCLE = 1 BAR = BEATS beats** (BEATS = the time signature numerator — 4 for 4/4, 3 for 3/4, 7 for 7/8). ALWAYS start the loop with it, e.g. \`setcpm(120/4)\` for 120 BPM in 4/4, or \`setcpm(120/7)\` for 7/8. (Omitting it defaults to a too-slow 30.) When the meter isn't 4/4, phrase patterns to fill the BEATS-beat bar (e.g. 7/8 → seven beats, not eight).
- A space-separated sequence FILLS EXACTLY ONE BAR, split EVENLY by item COUNT. You never specify note lengths — only how many slots there are:
  - In 4/4: \`"a b c d"\` → 4 even steps = one per beat (quarter notes). \`"a b"\` → 2 half-bar steps. \`"a b c d e f g h"\` → 8 eighth notes. In 7/8: \`"a b c d e f g"\` → the seven eighth-note beats of the bar.
- \`[ ]\` subdivides ONE slot to pack more into it: \`"bd [sd sd]"\` → kick across beats 1–2, two snares squeezed into beats 3–4. Nest freely: \`"bd [hh hh] sd [hh [hh hh]]"\`.
- \`<a b c>\` plays ONE element per CYCLE (per bar): bar 1 a, bar 2 b, bar 3 c, then loops. This is how a part evolves bar-to-bar — e.g. \`chord("<Cm7 Ab^7 Bb7 Cm7>")\` = one chord per bar.

## RESTS — how to leave a beat empty / "do nothing on this beat"
- \`~\` (tilde) is a REST = SILENCE for that slot (\`-\` also works). It STILL OCCUPIES its slot, so timing is unchanged — it just makes no sound. This is THE way to skip a beat and let a groove breathe:
  - \`"bd ~ sd ~"\` → kick on 1, REST on 2, snare on 3, REST on 4 (a backbeat).
  - \`"~ cp ~ cp"\` → claps only on beats 2 & 4. \`"bd ~ ~ ~"\` → kick on beat 1 only.
- Use rests liberally — space and silence make the groove; dense ≠ good.

## Mini-notation — full token reference (inside \`"..."\`; multi-line uses backticks)
| Token | Arg range | Meaning |
|---|---|---|
| space | — | sequence: split the bar evenly |
| \`[ ]\` | — | subgroup: subdivide one slot |
| \`< >\` | — | one element per cycle/bar |
| \`,\` | — | stack (play together) |
| \`~\` \`-\` | — | REST (silence; keeps its slot) |
| \`*n\` | n ≥ 0 real; 0 = silence | repeat n× faster within the slot |
| \`/n\` | n > 0 real | stretch over n cycles |
| \`@n\` | n > 0 real; default 1 | relative duration weight (this step longer/shorter) |
| \`!n\` | int ≥ 1 | replicate n× (same speed) |
| \`?\` \`?p\` | p 0–1; default 0.5 | randomly drop with probability p |
| \`(p,k,r)\` | p,k int, p ≤ k; r int rot (def 0) | Euclidean: p hits spread over k steps |
| \`:n\` | int ≥ 0 (wraps) | sample variant index |
| \`..\` | integers | numeric range, e.g. \`0..7\` |
| \`{ }%n\` | n int ≥1 | polymeter: n steps/cycle from each comma-group |

- Ops bind to the ONE token before them: \`"a b*2"\` doubles only b; group to affect more: \`"[a b]*2"\` → \`a b a b\`. \`*\` on \`<>\` compresses it into one bar: \`"<a b>*2"\` → \`a b\` each bar.
- \`,\` stacks anywhere: \`"[bd, hh*4]"\` = kick under 4 hats in one slot. Any numeric arg can itself be a pattern: \`"bd*<2 3>"\`, \`lpf("400 1200")\`.
- \`|\` = random choice, ONLY inside \`[ ]\` (e.g. \`"[bd | sd]"\`). It is NOT a bar line — using it as one is a parse error.
- No JS math inside a mini string — use methods instead: \`.add(7)\`, \`.fast(2)\`.

---

## Pitch (pick ONE primary per track)
- \`note(x)\` — string note name **or** number (MIDI). Names: \`[a-g]\` + accidentals \`#\`/\`s\` (+1 semitone each), \`b\`/\`f\` (−1) + octave \`0–9\`. No octave → octave 3. \`c4\`=MIDI 60, \`a4\`=69. Number passes straight through as MIDI.
- \`n(x)\` — number/int pattern. **With \`.scale()\`**: scale degree (0=root, 2=third…; negative & >scale-length wrap octaves). **With a sample \`s()\`**: sample variant index. **With \`chord().voicing()\`**: voice index.
- \`freq(hz)\` — number · Hz · absolute pitch, overrides \`note\`.
- \`transpose(n)\` — n semitones (any int, ±). \`scaleTranspose(n)\` — n scale-degrees within active scale (±).

Comma in a note string = chord (\`"c,eb,g"\`). Brackets = arpeggio (\`"[c eb g]"\`).

---

## Scale — \`.scale("Root[oct]:type[:variant]")\`
Root \`a–g\` + \`#\`/\`b\`/\`s\`/\`f\`, optional octave (default 3). Type cycles via pattern: \`"C:<major minor>/2"\`.
**Types:** \`major minor ionian dorian phrygian lydian mixolydian aeolian locrian\` · \`major:pentatonic minor:pentatonic\` · \`blues major:blues minor:blues\` · \`harmonic:minor melodic:minor harmonic:major\` · \`bebop:major bebop:minor bebop:dominant\` · \`whole:tone augmented diminished chromatic\` · \`hirajoshi iwato insen kumoijoshi chinese\` · \`phrygian:dominant gypsy:minor hungarian:minor double:harmonic:major persian byzantine flamenco neapolitan:minor\` · \`maqam:hijaz maqam:bayati maqam:rast\` · \`raga:bhairav raga:todi raga:kafi\`. Unknown name → falls back to chromatic.

---

## Chords — \`chord("symbols").voicing()\`
Symbol = \`Root[#/b]\` + quality. **Qualities:** \`(none)\`=major \`m\`(=\`-\`) \`M\`(=\`^\`) \`aug\`(=\`+\`) \`o\`(dim) \`h\`(half-dim) \`sus\` · \`5 6 7 9 11 13 69 add9\` · \`^7 ^9 ^13 m7 m9 m11 -7 -9\` · \`7sus 9sus 13sus\` · \`7b9 7#9 7#11 7b5 7#5 9#11 9b5 7alt 13#11 13b9\` · \`m7b5 m6 m69 mM7 -6 -69 -b6 -#5\`. (Use these spellings exactly — \`maj7\`/\`min7\`/\`sus4\`/\`dim\` are NOT recognised.)
- \`voicing()\` — expand chord to notes. (Always \`chord(...).voicing()\`, never \`note(...).voicing()\`.)
- \`dict(name)\` — string · \`"lefthand"\` (piano shells) or \`"ireal"\`. Default = built-in (~70 symbols). NOTE: \`lefthand\`/\`guidetones\` only voice 7th/extended chords (bare triads go silent).
- \`anchor(note)\` — note name/MIDI · default \`c5\` · alignment target.
- \`mode(str)\` — \`"below"\`(default) \`"above"\` \`"duck"\` \`"root"\`; inline anchor \`"root:g2"\`.
- \`offset(n)\` — integer · step to next available voicing up/down.
- \`rootNotes(oct)\` — emit only root at octave \`oct\` (default 2) — basslines.
- \`arp("idx pat")\` — play voiced notes as a sequence by voice index (numeric indices, e.g. \`"0 1 2"\` — NOT mode words like "up").

To transpose a note/chord pattern, wrap the amount: \`note("c2").add(note("<0 -4 -2>"))\` — a bare \`.add("<...>")\` on a note/chord throws "Can't do arithmetic on control pattern" and is silently dropped.

---

## Transforms (numeric args)
**Time** (factor = real > 0 unless noted):
- \`fast(n)\` / \`slow(n)\` — speed factor; \`n=0\`→silence.
- \`early(c)\` / \`late(c)\` — shift by **c cycles** (real, ±).
- \`clip(f)\` (=\`legato\`) — duration multiplier · >0 · ~.3 staccato, .7 normal, 1 legato, >1 overlap.
- \`ply(n)\` — integer ≥1 · repeat each event n× in its slot.
- \`hurry(n)\` — like \`fast\` but also pitches samples up (2 = +1 octave).
- \`segment(n)\` (\`seg\`) — integer ≥1 · sample a continuous signal n×/cycle.
- \`iter(n)\` — integer · rotate start point by 1/n each cycle.
- \`swing(n)\` — integer · n swing-pairs/cycle (offset fixed 1/3). \`swingBy(amt, n)\` — amt 0–1 swing depth.
- \`compress(a,b)\` / \`zoom(a,b)\` — a,b ∈ 0–1, a<b · squeeze into / play only [a,b].
- \`repeatCycles(n)\` — integer ≥1 · repeat each cycle n×.
- \`ribbon(off, len)\` — off = start cycle (any real), len = loop length in cycles (real >0).
- \`rev()\` \`palindrome()\` \`press()\` — no args.

**Structure / conditional:**
- \`struct("x ~ x x")\` — impose rhythm (x/1=hit, ~/0=rest).
- \`mask("1 0")\` — gate (0/~ silences).
- \`every(n, fn)\` / \`lastOf(n, fn)\` — integer n · apply fn every n cycles. \`when(binPat, fn)\`.
- \`chunk(n, fn)\` — integer n · apply fn to one of n slices, advancing each cycle.
- \`euclid(p,k)\` / \`euclidRot(p,k,r)\` — integers, p≤k.

**Value math** (arg = number/pattern):
- \`add sub mul div\` — arithmetic on values (note numbers, freqs, params).
- \`range(min,max)\` — map a 0–1 signal to [min,max] linearly. \`rangex\` = exponential. \`range2(min,max)\` maps a −1…1 signal.
- \`round floor ceil\` — no args.

**Layering:**
- \`superimpose(fn)\` — add a transformed copy. \`layer(...fns)\` — only the copies.
- \`off(c, fn)\` — c = delay in cycles (real) · add a delayed transformed copy.
- \`echo(times, c, fb)\` — times integer; c = gap in cycles; fb 0–1 feedback (volume decay).
- \`jux(fn)\` / \`juxBy(w, fn)\` — split stereo, fn on right; w 0–1. It spreads the two copies to (pan ± w/2) around the part's pan, which DEFAULTS to centre 0.5 — so keep a jux'd part CENTRED: do NOT also give it an off-centre \`.pan()\`, or one side lands outside [0,1] (a "pan clamped" warning + lopsided stereo). Use \`.pan()\` OR \`jux\`, not both off-centre.

**Randomness** (prob ∈ 0–1):
- \`degradeBy(p)\` — drop events with prob p. \`degrade()\`=0.5.
- \`sometimesBy(p, fn)\` — apply fn per-event with prob p. Named: \`always\`(1) \`almostAlways\`(.9) \`often\`(.75) \`sometimes\`(.5) \`rarely\`(.25) \`almostNever\`(.1) \`never\`(0).
- \`someCyclesBy(p, fn)\` — per-cycle version.
- \`shuffle(n)\` / \`scramble(n)\` — integer n · reorder n slices per cycle (scramble allows repeats).

---

## Signals (continuous 0–1; append \`2\` for −1…1)
\`sine cosine saw tri square\` · \`rand\` (random) · \`perlin\` (smooth random) · \`irand(n)\` (random int 0…n−1) · \`brand\` (0 or 1) · \`brandBy(p)\` (1 with prob p) · \`time\` (rising ramp) · \`mouseX\` \`mouseY\`. Sample them with \`.segment(n)\` or \`.range(a,b)\`.

---

## Factories
\`stack(...)\`=\`,\` · \`seq(...)\`=space · \`cat(...)\`=\`<>\` · \`arrange([cycles,pat],...)\` (sections, cycles=integer) · \`run(n)\`=\`0..n-1\` · \`silence\`.

---

## FILTERS
| Param | Type · range · default | Effect |
|---|---|---|
| \`lpf(hz)\` (cutoff,lp) | Hz, ~20–20000 · off when unset | low-pass cutoff. Higher = brighter. Mini \`"hz:q"\` also sets lpq |
| \`lpq(q)\` (resonance) | ~0–40 · default 1 | low-pass resonance/peak. Higher = squelchier |
| \`hpf(hz)\` (hp) / \`hpq(q)\` | as lpf/lpq · default q=1 | high-pass cutoff / resonance |
| \`bpf(hz)\` / \`bpq(q)\` | as above · default q=1 | band-pass center / width |
| \`ftype(t)\` | \`"12db"\`(default) \`"ladder"\`(Moog) \`"24db"\` | filter topology |
| \`drive(a)\` | real · ladder-type only | pre-filter overdrive |
| \`vowel(v)\` | \`a e i o u ae aa oe ue y uh un en an on\` | formant filter |
| \`fanchor(v)\` | 0–1 · default 0 | env direction: 0 opens up, 0.5 bipolar, 1 opens down |
| \`djf(v)\` | 0–1 · 0.5=off | DJ filter: <0.5 lowpass, >0.5 highpass |

## AMP ENVELOPE (all times in SECONDS)
| Param | Range · default | Effect |
|---|---|---|
| \`attack(s)\` (att) | ≥0.001 · default 0.001 | note-on → peak. Long = swell |
| \`decay(s)\` (dec) | ≥0.001 · default 0.001 | peak → sustain (audible only if sustain<1) |
| \`sustain(v)\` (sus) | 0–1 · default 1 | held level while note on |
| \`release(s)\` (rel) | ≥0.01 · default 0.01 | note-off → silence. Long = tail |
| \`adsr("a:d:s:r")\` | s:s:0-1:s | all four at once |
| \`hold(s)\` | seconds | force sustain length |
| \`dur(s)\` | cycles | note length in cycles (vs clip's multiplier) |

## FILTER ENVELOPE (per lp/hp/bp; times in seconds)
- \`lpa/lpd/lpr\` seconds, \`lps\` 0–1 — filter ADSR (default a/d/s/r = 0.005/0.14/0/0.1 when any set).
- \`lpenv(depth)\` (lpe) — sweep depth, ± (negative inverts direction); typical 1–8. Same for \`hpa…hpenv\`, \`bpa…bpenv\`.

## PITCH ENVELOPE
- \`pattack/pdecay/prelease\` seconds · \`psustain\` 0–1.
- \`penv(semitones)\` — depth, ± (negative inverts).
- \`pcurve(t)\` — 0 linear, 1 exponential.
- \`panchor(v)\` — 0–1 · 0 = bend up from note, 1 = bend down to note.

## DYNAMICS
| Param | Range · default | Effect |
|---|---|---|
| \`gain(a)\` | 0–2, 1=unity · default 0.8 | per-event volume |
| \`velocity(v)\` (vel) | 0–1 · default 1 | multiplies gain |
| \`postgain(a)\` | ≥0 · default 1 | volume after FX chain |
| \`compressor("t:r:k:a:r")\` | t,k dB; r ratio; a,r sec | defaults −3:10:10:0.005:0.05 |
| \`xfade(p1,f,p2)\` | f 0–1 | crossfade (0=p1, 1=p2) |

## PAN / SPATIAL
| Param | Range · default | Effect |
|---|---|---|
| \`pan(v)\` | 0–1 · 0=left, 0.5=center, 1=right | stereo position |
| \`jux(fn)\` / \`juxBy(w,fn)\` | w 0–1 | fn on right channel only |

## DISTORTION / SHAPING
| Param | Range · default | Effect |
|---|---|---|
| \`crush(d)\` | 1–16 (lower=harsher) · steps=2^(d−1) | bit-crush |
| \`coarse(n)\` | integer ≥1 | sample-rate reduction (n=hold samples) |
| \`shape(a)\` | 0–<1 | soft waveshaping (closer to 1 = more) |
| \`distort("amt:gain:type")\` | amt real; gain post; type e.g. \`diode\` | hard distortion (LOUD) |
| \`stretch(f)\` | real | time-stretch, preserves pitch |

## DELAY (per orbit)
| Param | Range · default | Effect |
|---|---|---|
| \`delay(lvl)\` | 0–1 · default 0 | send level. Mini \`"lvl:time:fb"\` |
| \`delaytime(s)\` (dt) | seconds · default 3/16 cycle | echo spacing |
| \`delayfeedback(fb)\` (dfb) | 0–0.98 · default 0.5 | repeats; higher = longer trail |

## REVERB (per orbit)
| Param | Range · default | Effect |
|---|---|---|
| \`room(lvl)\` | 0–1 (can exceed) · default 0 | reverb send. Mini \`"lvl:size"\` |
| \`roomsize(s)\` (sz,size) | seconds · default 2 | reverb decay length |
| \`roomfade(s)\` | seconds · default 0.1 | reverb fade-in |
| \`roomlp(hz)\` | Hz · default 15000 | reverb tone (lower=darker) |

IMPORTANT: the reverb and delay are SHARED per orbit. If two parts on the same orbit set different room/roomsize or delay settings, the engine rebuilds the effect mid-playback (audible crackle). Give each part with distinct reverb/delay its own \`orbit(2)\`, \`orbit(3)\`… (orbit only separates the FX buses, not the stereo output).

## MODULATION
| Param | Range · default | Effect |
|---|---|---|
| \`vib(hz)\` | Hz · mini \`"hz:depth"\` | pitch vibrato rate |
| \`vibmod(semi)\` | semitones | vibrato depth |
| \`tremolo(hz)\` / \`tremolosync(cyc)\` | Hz / cycles-per-period | amplitude LFO |
| \`tremolodepth(d)\` | 0–1 (>1 mutes dry) · default 1 | tremolo amount |
| \`phaser(hz)\` (ph) | Hz | phaser LFO rate |
| \`phaserdepth(d)\` (phd) | 0–1 · default 0.75 | phaser depth |
| \`phasercenter(hz)\` / \`phasersweep(hz)\` | Hz | phaser center / range |

## ROUTING / SIDECHAIN
- \`orbit(n)\` — integer · default 1 · separate delay/reverb/duck bus.
- \`duckorbit(n)\` — integer · sidechain-duck orbit n on each event. \`duckdepth(a)\` (0–1, default 1) · \`duckattack(s)\` (sec, default 0.1, recovery time).

## SAMPLE PLAYBACK (drums & samples)
| Param | Range · default | Effect |
|---|---|---|
| \`speed(n)\` | any real (− reverses) · default 1 | playback rate; 2 = octave up |
| \`begin(t)\` / \`end(t)\` | 0–1 · default 0 / 1 | sample start / end fraction |
| \`loop(b)\` | 0/1 · default 0 | loop sample |
| \`cut(g)\` | integer · default 0 | same group cuts off previous |
| \`chop(n)\` / \`striate(n)\` | integer ≥1 | granular slice into n parts |
| \`slice(n,"idx")\` / \`splice(n,"idx")\` | integer n | slice into n, trigger by index (splice = speed slices to fit step) |
| \`loopAt(c)\` | cycles | stretch sample over c cycles |
| \`n(i)\` | integer ≥0 (wraps) | variant index |

## FM SYNTH
- \`fm(i)\` — modulation index/depth, real ≥0 (~0–10), 0=off.
- \`fmh(r)\` — carrier:modulator ratio; whole numbers = harmonic, decimals = metallic.
- \`fmattack/fmdecay/fmrelease\` seconds · \`fmsustain\` 0–1 · \`fmwave(w)\` modulator shape \`sine\`(default)\`square sawtooth triangle crackle brown\`.

## SUPERSAW / POLY SYNTH
- \`unison(n)\` — integer 1–100 · default 5 · stacked voices.
- \`detune(a)\` — real · default 0.18 · spread between voices.
- \`spread(a)\` — 0–1 · default 0.6 · stereo width.

## PWM (pulse)
- \`pw(w)\` — 0–1 · default 0.5 (=square) · pulse width.
- \`pwrate(hz)\` — LFO Hz · \`pwsweep(d)\` 0–1 LFO depth.

---

## Instruments
\`s(name)\` (= \`sound(name)\`) selects the instrument; \`n\` or \`:n\` picks a variant. \`bank(name)\` prepends a kit name to drum lookups.
**Synths** (use with \`note\`): \`sine triangle square sawtooth supersaw pulse\`. Default when only \`note\` set = \`triangle\`. Noise: \`white pink brown crackle\`.
**Drums** (use with \`s\`, unpitched): \`bd\`(kick) \`sd\`(snare) \`rim\` \`cp\`(clap) \`hh\`(closed hat) \`oh\`(open hat) \`cr\`(crash) \`rd\`(ride) \`lt mt ht\`(toms) \`sh\`(shaker) \`cb\`(cowbell) \`tb\`(tambourine) \`perc\`. \`:n\` picks a variant; \`.bank("…")\` swaps the kit.
**Pitched samples** (use with \`note\`/\`n.scale\`): \`piano\`, and the \`gm_*\` General-MIDI soundfonts (short samples — set \`clip\` so they ring).
**Dirt sample kits** (the classic TidalCycles folders, e.g. \`arpy jvbass sitar gtr casio juno stab amencutup tabla jazz\`): each name is a folder of variants. \`s("arpy")\` plays variant 0; \`s("arpy:3")\` picks variant 3; \`n("0 2 4").s("arpy")\` sequences variants (great for melodic ones); pitch with \`note(...)\` or \`speed(...)\`. Breakbeat loops (\`amencutup breaks165 jungle\`) are full loops — chop with \`.chop(8)\`/\`.slice(8, "...")\`/\`.fit\` or fit to the cycle with \`.loopAt(1)\`.

Use EXACT names — sounds already in the loop, \`gm_\`/bank names, and the standard oscillators. Don't invent sound names (an unknown name loads nothing → silence).

---

## EXAMPLES — study the DIALECT and the shape, then COMPOSE FRESH for the request. Do NOT copy these; they are reference, not templates.
Each is a COMPLETE, valid loop across nine genres. Copy the HABITS, not the notes: setcpm(BPM/4) first; ONE $: per instrument; rests (~) for space; balanced gains (kick/bass forward, hats/pads/textures back); .clip() on every gm_* sample so it rings; transpose a note pattern with .add(note("…")); n(...).scale("Root:type") for scale-degree melodies; and any part with its OWN reverb/delay gets its OWN .orbit() (parts that share IDENTICAL reverb settings may share one orbit; parts with no reverb/delay stay on the default).

### 1) Techno — C minor, 128 BPM
setcpm(128/4)
// kick — four on the floor
$: s("bd*4").bank("RolandTR909").gain(0.9).shape(0.3)
// offbeat hat
$: s("~ hh ~ hh").bank("RolandTR909").gain(0.5).hpf(300).room(0.15).orbit(1)
// clap backbeat
$: s("~ cp ~ cp").bank("RolandTR909").gain(0.6).room(0.3).roomsize(2).orbit(2)
// rolling bass — root movement via add(note(...))
$: note("c2*8").add(note("<0 0 0 0 -4 -4 -2 -2>")).s("sawtooth").lpf(saw.range(400,1600).slow(8)).lpq(8).gain(0.7).shape(0.2)
// chord stabs
$: chord("<Cm7 Cm7 Ab^7 Bb7>").voicing().struct("~ x ~ x").s("sawtooth").attack(0.005).decay(0.15).sustain(0).lpf(1800).gain(0.5).room(0.4).roomsize(3).delay(0.2).delaytime((60/128)*0.5).delayfeedback(0.3).orbit(3)

### 2) Ambient — D major, 70 BPM
setcpm(70/4)
// warm pad bed
$: chord("<D^7 G^7 Bm7 A7>").voicing().slow(2).s("gm_pad_warm").clip(1).attack(1.5).release(3).gain(0.5).lpf(sine.range(1200,2400).slow(8)).room(0.7).roomsize(6).orbit(1)
// sub drone (pure sine, slow attack so it doesn't click)
$: note("<d2 g1 b1 a1>").slow(2).s("sine").attack(0.8).release(2.5).gain(0.45).lpf(500)
// sparse flute melody (gm_ sample → clip)
$: note("<d5 ~ a4 ~ f#5 ~ e5 ~>").s("gm_flute").clip(0.9).attack(0.1).release(1).gain(0.5).lpf(3000).room(0.6).roomsize(5).delay(0.3).delaytime((60/70)*0.5).delayfeedback(0.3).orbit(2)

### 3) Lo-fi hip-hop — A minor, 85 BPM
setcpm(85/4)
// swung boom-bap kick
$: s("bd ~ [~ bd] ~").bank("RolandTR707").gain(0.8).swingBy(0.15, 2)
// snare backbeat
$: s("~ sd ~ sd").bank("RolandTR707").gain(0.55).room(0.2).roomsize(2).swingBy(0.15, 2).orbit(1)
// soft hats
$: s("hh*8").gain("0.35 0.2".fast(4)).hpf(500).swingBy(0.15, 2)
// rhodes chords
$: chord("<Am7 Dm7 G7 C^7>").voicing().s("gm_epiano1").clip(0.95).attack(0.01).gain(0.5).lpf(2200).room(0.35).roomsize(2).orbit(2)
// upright bass roots
$: note("<a1 d2 g1 c2>").s("gm_acoustic_bass").clip(0.9).gain(0.65).lpf(700)
// vinyl crackle texture
$: s("crackle*2").gain(0.18).hpf(900)

### 4) House — F minor, 124 BPM
setcpm(124/4)
// four-on-the-floor kick
$: s("bd*4").bank("RolandTR909").gain(0.85).shape(0.2)
// 16th hats
$: s("[~ hh]*4").bank("RolandTR909").gain(0.45).hpf(400).room(0.12).orbit(1)
// clap backbeat
$: s("~ cp ~ cp").bank("RolandTR909").gain(0.5).room(0.25).roomsize(2).orbit(2)
// offbeat open hat
$: s("oh*4").bank("RolandTR909").gain("0 0.4 0 0.4").hpf(350)
// pumping synth bass (one root per bar, tracking the chords)
$: note("<f1 f1 db2 eb2>").s("gm_synth_bass_1").clip(0.6).gain(0.7).lpf(700)
// e-piano stabs
$: chord("<Fm7 Fm7 Db^7 Eb7>").voicing().struct("~ [x x] ~ x").s("gm_epiano2").clip(0.7).attack(0.005).gain(0.5).lpf(2600).room(0.35).roomsize(3).orbit(3)

### 5) Drum & bass — G minor, 174 BPM
setcpm(174/4)
// syncopated kick
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR909").gain(0.9)
// snare on beat 3 plus a ghost
$: s("~ ~ ~ ~ sd ~ ~ [~ sd]").bank("RolandTR909").gain(0.75).room(0.18).roomsize(2).orbit(1)
// fast hats
$: s("hh*16").gain("0.3 0.18".fast(8)).hpf(450)
// reese bass (roots track the chord per bar)
$: note("g1 ~ g1 ~").add(note("<0 0 -4 -5>")).s("sawtooth").lpf(600).lpq(6).gain(0.7).shape(0.3)
// atmospheric pad stab
$: chord("<Gm9 Gm9 Eb^7 D7>").voicing().struct("x ~ ~ ~").s("gm_pad_halo").clip(1).attack(0.3).gain(0.4).lpf(2200).room(0.5).roomsize(4).orbit(2)

### 6) Trap — C# minor, 140 BPM (half-time feel)
setcpm(140/4)
// booming kick
$: s("bd ~ ~ ~ ~ ~ bd ~").bank("RolandTR808").gain(0.9)
// snare on the backbeat
$: s("~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR808").gain(0.7).room(0.2).roomsize(2).orbit(1)
// rolling hats with a triplet burst (the <... [x x x]> is the roll)
$: s("hh*8").gain("0.35 0.35 0.5 0.2".fast(2)).hpf(500)
$: s("hh*16").gain("<0 0 0 [0.4 0.4 0.4]>").hpf(600)
// gliding 808 sub (pure sine = the sub-bass, roots track the chords)
$: note("<c#1 c#1 a1 b1>").s("sine").attack(0.005).decay(0.2).sustain(0.6).release(0.3).gain(0.8).lpf(400).shape(0.1)
// dark pad
$: chord("<C#m C#m A B>").voicing().struct("x ~ ~ ~").s("gm_pad_halo").clip(1).attack(0.5).gain(0.35).lpf(2000).room(0.5).roomsize(4).orbit(2)

### 7) Jazz trio — Bb major (ii–V–I), 120 BPM, swung
setcpm(120/4)
// swung ride
$: s("rd rd [rd rd] rd").bank("AkaiLinn").gain(0.4).swingBy(0.2, 2).room(0.2).roomsize(2).orbit(1)
// brushed snare
$: s("~ sd ~ sd").bank("AkaiLinn").gain(0.3).swingBy(0.2, 2)
// left-hand piano comping (the "lefthand" dict only voices 7th chords)
$: chord("<Cm7 F7 Bb^7 Bb^7>").voicing().dict("lefthand").struct("~ x ~ [x x]").s("gm_epiano1").clip(0.9).swingBy(0.2,2).attack(0.005).gain(0.5).lpf(2800).room(0.3).roomsize(2).orbit(2)
// upright bass (root + fifth per bar via a [.. ..] subgroup)
$: note("<[c2 g2] [f2 c3] [bb1 f2] [bb1 f2]>").s("gm_acoustic_bass").clip(0.95).gain(0.6).lpf(800)

### 8) Synthwave — A minor, 110 BPM
setcpm(110/4)
// punchy kick
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("LinnLM1").gain(0.85)
// gated-reverb snare
$: s("~ ~ ~ ~ sd ~ ~ ~").bank("LinnLM1").gain(0.7).room(0.6).roomsize(3).orbit(1)
// steady hats
$: s("hh*8").gain(0.3).hpf(500)
// driving 8th-note neon bass — roots A G F G track the chords via add(note())
$: note("a1*8").add(note("<0 -2 -4 -2>")).s("gm_synth_bass_2").clip(0.5).gain(0.7).lpf(600)
// arpeggiated supersaw — n + scale = scale degrees (0=root, 2=third…)
$: n("0 2 4 7 4 2 0 2").scale("A3:minor").s("supersaw").unison(5).detune(0.2).clip(0.5).gain(0.45).lpf(sine.range(800,2600).slow(4)).room(0.3).roomsize(2).delay(0.2).delaytime((60/110)*0.25).delayfeedback(0.3).orbit(2)
// warm pad
$: chord("<Am G F G>").voicing().s("gm_pad_warm").clip(1).attack(0.4).gain(0.35).lpf(2200).room(0.4).roomsize(4).orbit(3)

### 9) Cinematic — D minor, 60 BPM
setcpm(60/4)
// soft timpani pulse (a low-passed 808 kick)
$: s("bd ~ ~ bd ~ ~ ~ ~").bank("RolandTR808").gain(0.7).lpf(200).room(0.3).roomsize(4).orbit(1)
// string melody (aligned with the chords, all in D minor) — shares the strings' reverb bus with the pad (identical room settings → same orbit 2)
$: note("<d4 a4 bb4 f4>").s("gm_string_ensemble_1").clip(1).attack(0.4).release(1.2).gain(0.5).lpf(2600).room(0.6).roomsize(7).orbit(2)
// string pad chords (all diatonic to D natural minor — no clash with the harp/melody)
$: chord("<Dm Dm Bb F>").voicing().s("gm_string_ensemble_1").clip(1).attack(0.9).release(2).gain(0.38).lpf(1800).room(0.6).roomsize(7).orbit(2)
// harp — a fixed D-minor arpeggio, consonant over every chord
$: n("0 2 4 6").scale("D4:minor").s("gm_orchestral_harp").clip(0.9).gain(0.4).room(0.5).roomsize(5).delay(0.25).delaytime((60/60)*0.5).delayfeedback(0.25).orbit(3)
// low cello bass (roots D D Bb F)
$: note("<d2 d2 bb1 f1>").s("gm_cello").clip(1).attack(0.3).gain(0.5).lpf(900)
`;
