import { getUserId } from "@/lib/session";
import { addTokenUsage, assertQuota } from "@/lib/billing";
import { makeCallSink } from "@/lib/call-trace";
import { complete, ROUTE } from "@/lib/llm";
import { seal } from "@/lib/seal";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { hydraServerErrors } from "@/lib/hydra-eval";
import {
  CHAT_SYSTEM,
  chatUserText,
  makeChatSplitter,
  type ChatTurn,
} from "@/lib/zaltz-assist";

export const dynamic = "force-dynamic";

/**
 * THE CONVERSATION (2026-08-02) — the room's third panel, answered as it is
 * written. One model call, streamed twice over: the WORDS go to the chat as
 * they arrive, and a `[sound]`/`[picture]` block is buffered, gated, and sent
 * as a whole pane the browser drops straight into the editor — which, with the
 * transport on, means the room changes mid-sentence.
 *
 * Server-sent events, one JSON object per `data:` line:
 *   {t:"say",   v}          a slice of the answer's words
 *   {t:"open",  pane}       it has started writing that pane
 *   {t:"land",  pane, code} the pane, gated and ready (code is sealed)
 *   {t:"drop",  pane}       what it wrote would not build — nothing lands
 *   {t:"end"}               the turn is over
 *
 * THE GATE IS THE OTHER HALF OF THE PRODUCT (the whisper's own doctrine): a
 * pane only lands if it adds no error the coder's own pane didn't already
 * have. No code beats wrong code — especially here, where "wrong" is heard.
 */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) {
    return Response.json(
      { error: "session required", code: "session_required" },
      { status: 401 },
    );
  }
  if (!(await rateLimit(`chat:ip:${clientIp(req)}`, 30, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    strudel?: unknown;
    hydra?: unknown;
    message?: unknown;
    playing?: unknown;
    hit?: unknown;
    selection?: unknown;
    history?: unknown;
    warm?: unknown;
  } | null;

  // THE PRE-WARM — fired by the FIRST keystroke in the composer, never by the
  // panel merely opening. The conversation's system block is a ~17k-token cache
  // WRITE, and paying it on the human's own turn cost a measured ~2s of dead
  // air before the first word. Someone typing an ask is the moment that write
  // is genuinely owed, and it lands while they are still finishing the sentence.
  if (body?.warm === true) {
    const gate = await assertQuota(userId);
    if (gate) return gate;
    try {
      await complete(
        CHAT_SYSTEM,
        "warm",
        { onUsage: (t: number) => void addTokenUsage(userId, t) },
        { ...ROUTE.chat, maxTokens: 8 },
      );
    } catch {
      /* a cold cache is slower, never broken */
    }
    return Response.json({ warm: true });
  }

  const message = typeof body?.message === "string" ? body.message.slice(0, 2000).trim() : "";
  if (!message) return Response.json({ error: "empty" }, { status: 400 });
  const strudel = typeof body?.strudel === "string" ? body.strudel.slice(0, 20000) : "";
  const hydra = typeof body?.hydra === "string" ? body.hydra.slice(0, 20000) : "";
  const hitRaw = body?.hit as { title?: unknown; program?: unknown } | null | undefined;
  const hit =
    hitRaw && typeof hitRaw.program === "string" && hitRaw.program.trim()
      ? {
          title: typeof hitRaw.title === "string" ? hitRaw.title.slice(0, 120) : "the hit",
          program: hitRaw.program.slice(0, 12000),
        }
      : null;
  const selRaw = body?.selection as { pane?: unknown; text?: unknown } | null | undefined;
  const selection =
    selRaw && typeof selRaw.text === "string" && selRaw.text.trim()
      ? {
          pane: (selRaw.pane === "hydra" ? "hydra" : "strudel") as "strudel" | "hydra",
          text: selRaw.text.slice(0, 4000),
        }
      : null;
  // The transcript is WORDS ONLY — the panes above carry the current code, and
  // an old take in the history would only argue with the live one.
  const history: ChatTurn[] = (Array.isArray(body?.history) ? body.history : [])
    .slice(-12)
    .flatMap((t) => {
      const row = t as { role?: unknown; text?: unknown };
      const text = typeof row.text === "string" ? row.text.slice(0, 1200).trim() : "";
      if (!text) return [];
      return [{ role: row.role === "you" ? ("you" as const) : ("them" as const), text }];
    });

  const gate = await assertQuota(userId);
  if (gate) return gate;

  const sink = makeCallSink();
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (o: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
        } catch {
          closed = true; // the reader walked away mid-answer
        }
      };
      // Panes are held until the whole turn is over: a landed pane is a live
      // edit, and two of them arriving 200ms apart would evaluate the room
      // twice. One land per pane, gated, at the end of the block.
      const pending: { pane: "strudel" | "hydra"; code: string }[] = [];
      const splitter = makeChatSplitter({
        say: (v) => v && send({ t: "say", v }),
        open: (pane) => send({ t: "open", pane }),
        close: (pane, raw) => {
          const code = raw
            .replace(/^\s*```[a-z]*\r?\n?/i, "")
            .replace(/\r?\n?```\s*$/i, "")
            .replace(/^\r?\n+/, "")
            .replace(/\s+$/, "");
          pending.push({ pane, code });
        },
      });

      try {
        await complete(
          CHAT_SYSTEM,
          chatUserText({
            strudel,
            hydra,
            hit,
            playing: body?.playing === true,
            selection,
            history,
            message,
          }),
          {
            onUsage: (t: number) => void addTokenUsage(userId, t),
            onCall: sink.onCall,
          },
          {
            ...ROUTE.chat,
            trace: { kind: "ide-chat" },
            onDelta: (t) => splitter.push(t),
          },
        );
        splitter.end();
        // THE GATE, once the words have all arrived (a pane is only judged
        // whole). Differential — the coder's own unfinished pane is allowed to
        // be unfinished; the machine may not make it worse.
        for (const p of pending) {
          const base = p.pane === "hydra" ? hydra : strudel;
          if (!p.code.trim()) {
            // An emptied pane is a real answer ("lose the picture") — it can
            // never fail a gate, so it ships as-is.
            send({ t: "land", pane: p.pane, code: seal("") });
            continue;
          }
          const issues = await paneIssues(p.pane, base, p.code);
          if (issues.length) {
            console.log(`[klappn] chat pane dropped (${p.pane}): ${issues[0]}`);
            send({ t: "drop", pane: p.pane });
            continue;
          }
          send({ t: "land", pane: p.pane, code: seal(p.code) });
        }
      } catch (e) {
        console.error("[klappn] room chat failed:", e);
        send({ t: "fail" });
      } finally {
        send({ t: "end" });
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed by the reader */
          }
        }
        await sink.flush();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Nothing between here and the browser may sit on the bytes — a buffered
      // "stream" is just a slow request.
      "x-accel-buffering": "no",
    },
  });
}

/** Errors this pane would ADD over what the coder's own pane already carries. */
async function paneIssues(
  pane: "strudel" | "hydra",
  base: string,
  next: string,
): Promise<string[]> {
  if (pane === "hydra") {
    const had = new Set(hydraServerErrors(base));
    return hydraServerErrors(next).filter((e) => !had.has(e));
  }
  const { validateStrudel } = await import("@/lib/strudel-validate");
  const had = new Set(validateStrudel(base).errors);
  return validateStrudel(next).errors.filter((e) => !had.has(e));
}
