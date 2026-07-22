import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Klappn",
  description: "What Klappn keeps, where it lives, and how you take it back.",
};

/**
 * PRIVACY — the data half of the /open promises, stated as policy. Plain
 * speech IS the design; if this page and reality ever disagree, fixing that
 * outranks shipping anything. Changes are dated public commits.
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

export default function PrivacyPage() {
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
          Privacy
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          What the hosted service keeps, where it lives, and how you take it
          back. Last changed {UPDATED} — every change is a public commit.
        </p>
      </header>

      <Section title="What we keep">
        <p>
          Your email address — it is the whole account. Your work: songs,
          prompts, edits, arrangements, vocal takes you record, events you
          make or join. The record of the making — each model call&rsquo;s
          input and output, kept for the training purpose spelled out on{" "}
          <Link
            href="/open"
            className="text-foreground/80 underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
          >
            /open
          </Link>{" "}
          and in the{" "}
          <Link
            href="/terms"
            className="text-foreground/80 underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
          >
            Terms
          </Link>
          . Your token balance and purchase history. Ordinary server logs,
          kept briefly, for keeping the thing running.
        </p>
      </Section>

      <Section title="What we don't">
        <p>
          No ads. No third-party analytics, no trackers, no pixels. Nothing
          is sold, rented, or traded — to anyone, ever. The one cookie is
          your session: it keeps you signed in, and that&rsquo;s all it
          does. We never see your card number — that goes straight to
          Stripe.
        </p>
      </Section>

      <Section title="Who touches it">
        <p>
          The service runs on infrastructure that necessarily handles your
          data to do its job: Cloudflare serves and stores the app&rsquo;s
          files and audio, our database holds your account and songs, Stripe
          handles every payment, and when you compose, your prompt and the
          song&rsquo;s context go to Anthropic&rsquo;s API to run the model
          — under commercial terms where API traffic doesn&rsquo;t train
          their models. Each of these processes data on our instructions to
          provide the service — none of them gets it for their own use.
        </p>
        <p>
          Beyond that, data leaves our hands only if the law makes us, and
          only the minimum it makes us.
        </p>
      </Section>

      <Section title="The training record, and opting out">
        <p>
          The record of the making trains Klappn&rsquo;s own music model —
          said before you ever compose, not found out later. Opt out any
          time: reply to any mail Klappn has sent you, or open a GitHub
          issue, and your account never touches training. Past included, no
          questions.
        </p>
        <p>
          Self-host, and none of this page exists: your instance tells us
          nothing.
        </p>
      </Section>

      <Section title="Keeping, and taking back">
        <p>
          We keep your work for as long as you keep your account, so your
          music is there when you come back. Delete a song and it&rsquo;s
          gone from your library; write us to delete the account and the
          account goes — email, songs, the lot, within thirty days,
          save what payment law makes us hold (Stripe&rsquo;s transaction
          records) and short-lived backups on their way out.
        </p>
        <p>
          You can also just ask: what we hold on you, a copy of it, or a
          correction — reply to any mail Klappn has sent you and it&rsquo;s
          yours. Where you live may give these asks legal names (GDPR, CCPA);
          the answer is yes either way.
        </p>
      </Section>

      <p className="mt-8 text-[13px] leading-relaxed text-muted/70">
        The whole deal in plain words:{" "}
        <Link
          href="/open"
          className="underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
        >
          /open
        </Link>{" "}
        · the binding version:{" "}
        <Link
          href="/terms"
          className="underline decoration-white/20 underline-offset-2 transition hover:text-foreground"
        >
          Terms
        </Link>
        . If a sentence on this page ever stops being true, that&rsquo;s a
        bug. File it.
      </p>
    </main>
  );
}
