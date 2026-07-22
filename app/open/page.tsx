import type { Metadata } from "next";
import Link from "next/link";
import { DISCORD_URL, GITHUB_URL, ZALTZ_GITHUB_URL } from "@/lib/links";
import {
  TOKENS_PER_LOOP,
  USD_CENTS_PER_MILLION,
} from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Open — Klappn",
  description: "Klappn is open source. The whole deal, in plain words.",
};

/**
 * THE TRANSPARENCY PAGE — the one place in the app where plain speech IS the
 * design. Everything a user might want to know before trusting us: the code,
 * the price math, and exactly what happens to what they make. If a sentence
 * here ever stops being true, fixing that outranks shipping anything.
 */
export default function OpenPage() {
  const usdPerM = (USD_CENTS_PER_MILLION / 100).toFixed(0);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pb-28 pt-6 sm:pt-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="group -ml-1 flex items-center gap-1 text-[15px] text-muted transition hover:text-foreground"
        >
          <span className="text-lg leading-none transition group-hover:-translate-x-0.5">
            ‹
          </span>
          Loops
        </Link>
      </div>

      <header className="mt-12">
        <h1 className="wordmark text-gradient text-[40px] leading-[0.95] tracking-tight sm:text-[54px]">
          Open
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          The whole machine, face up on the table. The code, the price, the
          plan — nothing under your music you can’t read.
        </p>
      </header>

      {/* community */}
      <section className="animate-rise mt-9 rounded-[22px] border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5">
        <h2 className="text-[15px] font-medium text-foreground">
          The code and the room
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Every prompt that talks to the model. The audio engine, byte by
          byte. This very page. All of it AGPL-3.0 — the same license as{" "}
          <a
            href="https://strudel.cc"
            target="_blank"
            rel="noreferrer"
            className="text-foreground/80 underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
          >
            Strudel
          </a>
          , the language your loops speak.{" "}
          {GITHUB_URL
            ? "Run it, fork it, bend it, steer it."
            : "The public repo lands here shortly — then run it, fork it, bend it, steer it."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {GITHUB_URL ? (
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-foreground transition hover:bg-white/[0.1]"
            >
              GitHub
            </a>
          ) : (
            <span className="rounded-full bg-white/[0.04] px-4 py-2 text-[13px] text-muted/60">
              GitHub — opening soon
            </span>
          )}
          <a
            href={ZALTZ_GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-foreground transition hover:bg-white/[0.1]"
          >
            zaltz — the audio engine, out now
          </a>
          {DISCORD_URL ? (
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-foreground transition hover:bg-white/[0.1]"
            >
              Discord
            </a>
          ) : (
            <span className="rounded-full bg-white/[0.04] px-4 py-2 text-[13px] text-muted/60">
              Discord — opening soon
            </span>
          )}
        </div>
      </section>

      {/* price math */}
      <section className="animate-rise mt-4 rounded-[22px] border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5">
        <h2 className="text-[15px] font-medium text-foreground">
          A price you can read
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Prepaid tokens, ${usdPerM} per million. A loop runs about{" "}
          {Math.round(TOKENS_PER_LOOP / 1000)}k tokens — a dollar is roughly
          three loops — and tokens never expire. The card fee is Stripe’s,
          shown before you pay. The entire price sheet is{" "}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[12px]">
            lib/pricing.ts
          </code>{" "}
          — one screen of open code, so the price is something you read,
          and any change to it is a commit with our name on it, never a
          surprise on a bill. The free taste and the servers are on us.
          Rather hold the keys yourself? Self-host: your model key, your
          bill, our code.
        </p>
      </section>

      {/* data */}
      <section className="animate-rise mt-4 rounded-[22px] border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5">
        <h2 className="text-[15px] font-medium text-foreground">
          What happens to what you make
        </h2>
        <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-muted">
          <p>
            Your songs are yours. Play them anywhere, take them anywhere.
          </p>
          <p>
            On this hosted service we keep the record of the making — your
            prompt, the model’s work, your edits, what you kept, what you
            killed. Here’s why, said now so you never find it out later:
            we’re going to raise Klappn’s own music model on the best of
            what’s made here, so this tool stops renting anyone else’s
            brain. That model stays inside this project.
          </p>
          <p>
            Want out? Say the word — the Discord or GitHub once they’re
            live, or reply to any mail Klappn has sent you — and your
            account never touches training. Past included, no questions.
          </p>
          <p>
            Self-host, and none of this exists: your instance tells us
            nothing.
          </p>
        </div>
      </section>

      <p className="mt-8 text-[13px] leading-relaxed text-muted/70">
        We’d rather earn a community than rent customers. Every sentence on
        this page is a promise — if one ever breaks, that’s a bug. File it.
        The binding version:{" "}
        <Link
          href="/terms"
          className="underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
        >
          Terms
        </Link>{" "}
        ·{" "}
        <Link
          href="/privacy"
          className="underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
        >
          Privacy
        </Link>{" "}
        — same plain words, signed.
      </p>
    </main>
  );
}
