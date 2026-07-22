import type { Metadata } from "next";
import Link from "next/link";
import { GITHUB_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Terms — Klappn",
  description: "The terms of the hosted service, in plain words.",
};

/**
 * TERMS OF SERVICE — same rule as /open: plain speech IS the design. This is
 * the binding version of the promises made there; if the two pages ever
 * disagree, fixing that outranks shipping anything. Like the price sheet,
 * any change to these terms is a commit with our name on it.
 */
const UPDATED = "July 22, 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="animate-rise mt-4 rounded-[22px] border border-white/[0.07] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5">
      <h2 className="text-[15px] font-medium text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
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
          Terms
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          The deal for the hosted service at klappn.com, in plain words.
          Signing in means you agree to it. Last changed {UPDATED} — and like
          everything here, every change is a public commit.
        </p>
      </header>

      <Section title="What this covers">
        <p>
          These terms cover the hosted service — the Klappn that runs at
          klappn.com, on our servers, with our model key. The code itself is
          AGPL-3.0 and yours to run; a self-hosted Klappn is governed by that
          license, not by this page.
        </p>
        <p>
          The service is run by Klappn (the maintainers of{" "}
          {GITHUB_URL ? (
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="text-foreground/80 underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
            >
              the public repository
            </a>
          ) : (
            "the public repository"
          )}
          ). To reach us: reply to any mail Klappn has sent you, or open a
          GitHub issue.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          One email address is the whole account — a 6-digit code signs you
          in, there is no password to keep. Keep your inbox yours: anyone who
          can read your email can be you here. You must be at least 13 to use
          the service, and old enough to agree to terms like these where you
          live.
        </p>
      </Section>

      <Section title="Your music">
        <p>
          Your songs are yours. Prompts, loops, arrangements, recordings —
          we claim no ownership, and you can export and take them anywhere,
          anytime. You give us just the permission needed to run the service:
          to store your work, play it back to you, and process it through the
          model when you ask for changes.
        </p>
        <p>
          Share links share: a song, set, or event page you send someone
          plays for whoever holds the link. Don&rsquo;t upload or record what
          you have no right to — that one is on you.
        </p>
      </Section>

      <Section title="What we learn from the making">
        <p>
          On the hosted service we keep the record of the making — your
          prompts, the model&rsquo;s work, your edits, what you kept, what
          you killed — and we will use it to raise Klappn&rsquo;s own music
          model, so this tool stops renting anyone else&rsquo;s brain. That
          model stays inside this project.
        </p>
        <p>
          Want out? Say the word — reply to any mail Klappn has sent you, or
          open a GitHub issue — and your account never touches training.
          Past included, no questions. Self-host, and none of this exists.
        </p>
      </Section>

      <Section title="Tokens and money">
        <p>
          Generation runs on prepaid tokens at the public rate on{" "}
          <Link
            href="/open"
            className="text-foreground/80 underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
          >
            /open
          </Link>{" "}
          — the whole price sheet is one screen of open code, and any change
          to it is a commit, never a surprise on a bill. Tokens never expire.
          The card fee is Stripe&rsquo;s, shown before you pay and itemized
          at checkout.
        </p>
        <p>
          The free taste is one per account, drawn from a small fixed pool —
          the first three hundred accounts to compose — and it&rsquo;s gone
          when it&rsquo;s gone. Grants already claimed stay claimed.
        </p>
        <p>
          Tokens buy computation, which is spent the moment it runs, so
          spent tokens aren&rsquo;t refundable. If a purchase went wrong,
          write us — we&rsquo;d rather fix it than argue.
        </p>
      </Section>

      <Section title="Events and tickets">
        <p>
          Event pages let an organizer take RSVPs and sell tickets. The
          organizer is selling to you; Klappn moves the money through Stripe
          and keeps a 10% platform fee, shown to the organizer up front.
          Whether the night delivers is between you and the organizer —
          sort refunds out with them first, and pull us in if you get stuck.
        </p>
      </Section>

      <Section title="Fair play">
        <p>
          Don&rsquo;t use the service to break the law, to make or spread
          content that harms people, or to attack the service itself —
          probing other accounts, scraping the model, reselling access.
          We can suspend an account that does; for anything short of
          plain abuse we&rsquo;ll say what and why first.
        </p>
      </Section>

      <Section title="The honest limits">
        <p>
          The service is provided as-is. We run it with care and in the
          open, but we don&rsquo;t promise it will always be up, that
          generations always land, or that any feature stays forever. To
          the extent the law allows, our total liability to you is capped
          at what you paid us in the twelve months before the claim. Some
          places don&rsquo;t allow some of these limits — where the law
          says otherwise, the law wins.
        </p>
      </Section>

      <Section title="Leaving, and changes">
        <p>
          Leave whenever you like: export your music, then write us to
          delete the account — it all goes. If we ever have to wind the
          hosted service down, you get notice and time to take everything
          with you; the code stays open either way. That is the exit these
          terms can&rsquo;t take from you.
        </p>
        <p>
          When these terms change, the change is a dated public commit and
          the date above moves. Keep using the service after a change and
          the new terms are the deal.
        </p>
      </Section>

      <p className="mt-8 text-[13px] leading-relaxed text-muted/70">
        The plain-words version of everything here lives on{" "}
        <Link
          href="/open"
          className="underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
        >
          /open
        </Link>{" "}
        · your data&rsquo;s story is the{" "}
        <Link
          href="/privacy"
          className="underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
        >
          Privacy page
        </Link>
        . If a sentence on this page ever stops being true, that&rsquo;s a
        bug. File it.
      </p>
    </main>
  );
}
