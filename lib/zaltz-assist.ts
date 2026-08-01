import { STRUDEL_SPEC } from "./strudel-spec";
import { HYDRA_SPEC } from "./hydra-spec";

/**
 * THE IDE'S AI — two surfaces, both quiet servants of the coder's hands
 * (the Ask/proposal path and the tweak chips lived here once; both were cut
 * 2026-07-26 when the product settled on copilot + dials — git history keeps
 * them):
 *
 *  1. THE COPILOT — ghost completion at the caret (/api/complete). Opus 5
 *     thinking-DISABLED: dialect accuracy at no-thinking latency. The other
 *     pane rides along as read-only context.
 *  (A NAMER — AI names on the mixer faders — lived here briefly; it died
 *  2026-07-26 when the mixer became the Sets deck: deterministic channel
 *  kills + master-chain dials need no names. Git history keeps it.)
 */

// ── THE COPILOT ──────────────────────────────────────────────────────────────

const COMPLETE_CONTRACT = `You are inline code-completion in a live-coding IDE. You get the code BEFORE the cursor and the code AFTER it. Output ONLY the raw text to insert at the cursor — no prose, no fences, no backticks around or after the code, never repeat text that is already there. Match the file's own style and vocabulary; finish the current line, or add the next line(s) that most belong — added lines BEGIN WITH A NEWLINE; never glue a comment or a new statement onto the end of an existing line. A comment stating an intent ("// rolling acid bassline") is an ASK — write the code that fulfils it on the following line(s). Never output only a comment: every completion must contain code (if the cursor is inside an unfinished comment, finish it, then write the code it asks for). When text follows the cursor ON THE SAME LINE, complete only what fits between — finish the expression there, never start a new line. Stop at a natural point (at most ~6 lines). A live sketch is NEVER finished: when the cursor sits at the end of code that already runs, offer the next move — a new line (or lines) that serves what is already playing. A move the sketch already made is not a move: never re-offer a line or transform the file already has. Output nothing only when no insertion at this exact spot could be valid.`;

export const COMPLETE_STRUDEL_SYSTEM = `${COMPLETE_CONTRACT}

The file is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer. Stay in the file's key and grid; add layers that serve the loop (never double an existing voice). A running loop nearly always has a next move — an unfilled role, a variation, a quiet layer under what plays; an empty answer is a last resort, never a habit. When the stack is already dense, prefer a VARIATION or a sparse, quiet voice over another loud layer. A HYDRA pane may be given as read-only context — never emit hydra code here.

A layer written \`_$:\` is STAGED: it sits in the file, silent, until the coder wakes it. Write staged lines ONLY when the ask is for something to bring in LATER — a comment asking for the next section, a drop, a part to switch to. Everything else you write sounds.

${STRUDEL_SPEC}`;

export const COMPLETE_HYDRA_SYSTEM = `${COMPLETE_CONTRACT}

The file is a Hydra sketch for this IDE: chains ending in .out() (NOTHING chains after .out()), hydra's own clocks frozen, all motion via H(<strudel signal>). Plain JS is part of the dialect — a sketch may keep a control bus of its own (\`let arc = H(saw.slow(16))\`, arrow functions combining those thunks, Math, arrays) and pass the functions into params; follow the file's style when it has one. After a chain's .out() the next move is a NEW chain on its own line — a src(o0).<transforms>.out() post-chain (feedback welcome) or a fresh source; never chain methods onto .out() itself. Never repeat a move the file already made: one src(o0) post-chain is enough — after that, vary something else (deepen an existing chain's arguments, add a different modulation, blend a new source). MORE IS NOT BETTER in a picture: two or three chains fill a frame — past that, offer only the smallest touch (one argument's modulation, a subtle post-chain), or nothing at all; a sketch that keeps growing turns to mud. The STRUDEL pane may be given as read-only context — read its loop length and energy so every H() period divides the loop; never emit strudel code here.

${HYDRA_SPEC}`;

// ── THE ONE-TAP FIX ──────────────────────────────────────────────────────────
// The error chip's ✦ fix: the broken pane + its error in, the mended pane out.
// Thinking-off (a fix is surgery, not composition); the route gates the result
// with the same server validators the ghost rides.

const FIX_CONTRACT = `You are the one-tap FIX in a live-coding IDE. You get a file and the error it throws at eval. Output ONLY the corrected file, whole — raw code, no prose, no fences. Make the SMALLEST change that kills the error; keep everything else byte-identical (same style, same ideas, no additions, no commentary). If the error cannot be caused by this code, output the file unchanged.`;

export const FIX_STRUDEL_SYSTEM = `${FIX_CONTRACT}

The file is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer.

${STRUDEL_SPEC}`;

export const FIX_HYDRA_SYSTEM = `${FIX_CONTRACT}

The file is a Hydra sketch for this IDE: chains ending in .out() (NOTHING chains after .out()), all motion via H(<strudel signal>).

${HYDRA_SPEC}`;

// ── THE EXPLAIN ──────────────────────────────────────────────────────────────
// Select a fragment, tap ✦ explain: one on-demand Sonnet call (never
// pre-computed — commentary ahead of time is tokens burned on lines nobody
// asked about). The point is TEACHING: the coder leaves able to write it.

const EXPLAIN_CONTRACT = `You are the teacher inside a live-coding room. You get a file and a SELECTED fragment of it. Explain what the fragment does IN THIS FILE, so the coder learns to write it themselves. Plain words, concrete: name what the ear hears (or the eye sees) when it runs, and what the key values are doing. 2-4 short sentences, prose only — no headers, no lists, no code fences. If one value is worth turning to feel it, end by saying which and which way. Speak only to the selection in its context; never walk the whole file.`;

export const EXPLAIN_STRUDEL_SYSTEM = `${EXPLAIN_CONTRACT}

The file is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer.

${STRUDEL_SPEC}`;

export const EXPLAIN_HYDRA_SYSTEM = `${EXPLAIN_CONTRACT}

The file is a Hydra sketch: chains ending in .out(), all motion via H(<strudel signal>).

${HYDRA_SPEC}`;

/** The explain call's user block. */
export function explainUserText(code: string, sel: string): string {
  return `THE FILE:
${code}

THE SELECTION TO EXPLAIN:
${sel}`;
}

// ── THE CONVERSATION ─────────────────────────────────────────────────────────
// The room's third panel (2026-08-02, user: "a conversation with an AI just
// like in Claude… it can make changes before our very eyes"). One agent that
// TALKS and WRITES: it answers in plain words and, when the ask is a change,
// emits the whole new pane between markers — which the route gates and the
// browser lands in the pane, live, mid-set.
//
// Whole panes, not diffs, on purpose: a fragment has to be matched back into a
// file that the hands may have moved under it, and a mis-splice in a room that
// is PLAYING is heard. A whole pane either parses or it doesn't.

const CHAT_CONTRACT = `You are the other half of a live-coding room, talking with the person at the desk. Two panes are open in front of you both: THE SOUND (a Strudel loop) and THE PICTURE (a Hydra sketch). What is in them is playing RIGHT NOW, and anything you write lands in the room within a breath — write as if someone is listening, because they are.

TALK LIKE A BANDMATE: plain sentences, concrete, SHORT — two or three at most, often one. No headings, no bullet lists, no markdown, no code fences in your words, and never a line-by-line walkthrough unless you are asked for one. Name what the ear will hear or the eye will see ("a longer tail on the hats", "the picture breathes with the bass"), never a changelog of method names. When they ask a question, answer it — a question is not a request for new code.

TO CHANGE THE ROOM, WRITE THE PANE. Put the WHOLE new pane between its own markers, each marker alone on its line, after your words:
[sound]
…the entire sound pane…
[/sound]
[picture]
…the entire picture pane…
[/picture]
Raw code between the markers — no fences, no prose (comments that belong in the file are fine). Emit ONLY a pane you actually changed, and inside it keep every line the ask did not touch BYTE-IDENTICAL: this is someone's live take, not your draft. What you emit REPLACES that pane, so it must be whole and runnable by itself. Never write a pane you were not asked to touch, and never write one just to show your work.

Silencing is a first-class change: prefix a layer's \`$:\` as \`_$:\` to mute it without losing it (a \`_$:\` layer is staged — it sits there silent until they wake it). Removing a layer means it is simply gone from the pane you write.`;

export const CHAT_SYSTEM = `${CHAT_CONTRACT}

THE SOUND PANE is a Strudel loop: \`setcpm(BPM/beatsPerBar)\` first, then one \`$:\` line per layer. Stay in the room's key, tempo and grid unless they ask you to move it.

THE PICTURE PANE is a Hydra sketch for this room: chains ending in .out() (NOTHING chains after .out()), hydra's own clocks frozen, all motion via H(<strudel signal>). Plain JS is part of the dialect (a control bus of \`let x = H(saw.slow(16))\` thunks, arrow functions, Math, arrays). More is not better in a picture: two or three chains fill a frame. Every H() period should divide the loop that is playing.

${STRUDEL_SPEC}

${HYDRA_SPEC}`;

/** One turn in the room's conversation, as the client keeps it. */
export interface ChatTurn {
  role: "them" | "you";
  text: string;
}

/** The conversation call's user block. The PANES are the state — the machine's
 *  own past code is stripped out of the transcript (it is either in the pane
 *  above or it was undone), which keeps a long conversation cheap and stops an
 *  old take arguing with the live one. */
export function chatUserText(o: {
  strudel: string;
  hydra: string;
  hit?: { title: string; program: string } | null;
  playing: boolean;
  selection?: { pane: "strudel" | "hydra"; text: string } | null;
  history: ChatTurn[];
  message: string;
}): string {
  const parts = [
    `THE SOUND PANE:\n${o.strudel.trim() || "(empty)"}`,
    `THE PICTURE PANE:\n${o.hydra.trim() || "(empty)"}`,
  ];
  if (o.hit?.program) {
    parts.push(
      `THE HIT PLAYING UNDER THE BENCH — "${o.hit.title}". It is not in either pane and it is not yours to change; the sound pane's layers play OVER it, so answer in its key, its tempo and its grid:\n${o.hit.program}`,
    );
  }
  parts.push(
    o.playing
      ? "THE ROOM IS PLAYING — what you write is heard the moment it lands."
      : "THE ROOM IS STOPPED — what you write waits for them to press play.",
  );
  if (o.selection?.text.trim()) {
    parts.push(
      `THEY HAVE SELECTED, in the ${o.selection.pane === "hydra" ? "picture" : "sound"} pane:\n${o.selection.text}`,
    );
  }
  if (o.history.length) {
    parts.push(
      `EARLIER IN THIS CONVERSATION (oldest first):\n${o.history
        .map((t) => `${t.role}: ${t.text}`)
        .join("\n")}`,
    );
  }
  parts.push(`THEY SAY:\n${o.message}`);
  return parts.join("\n\n");
}

/** A chat answer, split as it streams: prose out one way, pane code the other.
 *
 *  The markers arrive in pieces (a delta can end mid-`[/sou`), so prose is held
 *  back by the length of the longest marker until it is proven not to be one —
 *  that lag is invisible at streaming speed and it is what keeps a half-written
 *  `[sound]` from flashing up as words. */
export function makeChatSplitter(sink: {
  say: (text: string) => void;
  open: (pane: "strudel" | "hydra") => void;
  close: (pane: "strudel" | "hydra", code: string) => void;
}) {
  const OPEN = { "[sound]": "strudel", "[picture]": "hydra" } as const;
  const CLOSE = { strudel: "[/sound]", hydra: "[/picture]" } as const;
  const HOLD = 10; // "[/picture]".length — the longest marker
  let buf = "";
  let pane: "strudel" | "hydra" | null = null;
  let code = "";

  const pump = (final: boolean) => {
    for (;;) {
      if (!pane) {
        const m = buf.match(/\[(sound|picture)\]\r?\n?/);
        if (!m) {
          const safe = final ? buf.length : Math.max(0, buf.length - HOLD);
          if (safe > 0) {
            sink.say(buf.slice(0, safe));
            buf = buf.slice(safe);
          }
          return;
        }
        const at = m.index ?? 0;
        if (at > 0) sink.say(buf.slice(0, at));
        pane = OPEN[`[${m[1]}]` as keyof typeof OPEN];
        code = "";
        buf = buf.slice(at + m[0].length);
        sink.open(pane);
        continue;
      }
      const end = buf.indexOf(CLOSE[pane]);
      if (end < 0) {
        const safe = final ? buf.length : Math.max(0, buf.length - HOLD);
        if (safe > 0) {
          code += buf.slice(0, safe);
          buf = buf.slice(safe);
        }
        if (!final) return;
        // The stream ended mid-pane (a cap-truncated answer). Close it anyway —
        // the gate decides whether a half-written pane is shippable, and it
        // won't be, which is the honest outcome.
        sink.close(pane, code);
        pane = null;
        return;
      }
      code += buf.slice(0, end);
      buf = buf.slice(end + CLOSE[pane].length).replace(/^\r?\n/, "");
      sink.close(pane, code);
      pane = null;
      code = "";
    }
  };

  return {
    push(delta: string) {
      buf += delta;
      pump(false);
    },
    end() {
      pump(true);
    },
  };
}

/** The fix call's user block. */
export function fixUserText(code: string, error: string): string {
  return `THE FILE:
${code}

THE ERROR IT THROWS:
${error}`;
}

/** The user block for one completion call, SPLIT for the prompt cache: the
 *  read-only context (the other pane — byte-stable across a whole typing
 *  burst) rides as CompleteOpts.cacheStable, its own cache-marked block, so
 *  every keystroke's summon re-reads [system + context] at ~0.1× instead of
 *  re-paying it; only BEFORE/AFTER vary per call. stable + tail concatenate
 *  to exactly the old single-block text — semantics unchanged. */
export function completeUserParts(
  before: string,
  after: string,
  context: string,
  contextLabel: string,
  midi?: string,
): { stable: string; tail: string } {
  // Recent MIDI rides the VARYING tail (it changes with every phrase played —
  // caching it would poison the stable block).
  const played = midi?.trim()
    ? `JUST PLAYED on the connected keys (oldest first — the coder may want the loop to answer this phrase, in its key and shape): ${midi.trim()}\n\n`
    : "";
  return {
    stable: context.trim()
      ? `${contextLabel} (read-only context):\n${context}\n\n`
      : "",
    tail: `${played}BEFORE (cursor at the end of this):
${before}
AFTER:
${after || "(end of file)"}`,
  };
}

/** Clean a raw completion: strip fences, drop overlap with what's already
 *  typed, kill trailing junk. Empty string = nothing to show. */
export function cleanCompletion(raw: string, before: string): string {
  let s = raw.replace(/^\s*```[a-z]*\r?\n?/i, "").replace(/\r?\n?```\s*$/i, "");
  s = s.replace(/\s+$/, "");
  // Sonnet sometimes wraps the answer in SINGLE backticks (inline-code habit)
  // — a stray edge backtick reads as a template literal and kills the eval
  // ("Unterminated template", seen live). Our dialect never uses backticks,
  // so edge ones are always wrapper junk.
  s = s.replace(/^`+/, "").replace(/`+\s*$/, "");
  if (!s) return "";
  // A model that re-emits the tail of `before` — trim the longest overlap.
  const tail = before.slice(-Math.min(before.length, 200));
  for (let n = Math.min(tail.length, s.length); n > 0; n--) {
    if (tail.endsWith(s.slice(0, n))) {
      s = s.slice(n);
      break;
    }
  }
  s = s.replace(/^\r?\n(?=\S)/, "\n");
  // A no-thinking model's laziest "next move" is the move the file JUST made —
  // the same line again (seen live: `.every(4, x=>x.ply(2))` ghosted right
  // under an identical line, twice running). An echo is not a move: drop
  // ghost lines that duplicate the line directly above them (in the file or
  // within the ghost itself).
  {
    const lines = s.split("\n");
    const kept: string[] = [];
    let prev = before
      .split("\n")
      .filter((l) => l.trim())
      .pop()
      ?.trim();
    for (const line of lines) {
      const t = line.trim();
      if (t && t === prev) continue;
      kept.push(line);
      if (t) prev = t;
    }
    s = kept.join("\n");
    if (!s.trim()) return "";
  }
  // Completing at the end of a COMMENT line: without a leading newline the
  // taken code lands INSIDE the comment and falls silent. Deterministic guard.
  const lastLine = before.slice(before.lastIndexOf("\n") + 1);
  if (s && !s.startsWith("\n") && /^\s*\/\//.test(lastLine)) s = "\n" + s;
  // The mirror case — starting a NEW statement at the end of a CODE line: a
  // `//` or `$:` can never continue an expression, so glued inline it comments
  // out the tail or breaks the line (seen on prod: "// clap layered…" welded
  // onto `.orbit(6)`). Same deterministic newline.
  else if (s && !s.startsWith("\n") && lastLine.trim() && /^\s*(\/\/|\$:)/.test(s))
    s = "\n" + s;
  return s;
}
