"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { openDeep } from "@/lib/seal";

/**
 * EVENTS — the organizer's side. A gallery of moments, not a dashboard: each
 * event is one card (poster thumb, title, when, the count of people coming).
 * Creating one is a single machined sheet — name it, place it, time it, price
 * it (or don't), drop a poster on it — and the link is ready for WhatsApp.
 */

export interface EventItem {
  id: string;
  token: string;
  title: string;
  tagline: string | null;
  venue: string | null;
  startsAt: string | null;
  endsAt: string | null;
  salesCloseAt: string | null;
  tz: string | null;
  priceCents: number;
  capacity: number | null;
  status: "live" | "cancelled";
  hasPoster: boolean;
  trackPartId: string | null;
  updatedAt: string;
  confirmed: number;
  grossCents: number;
  feeCents: number;
}

interface Draft {
  title: string;
  tagline: string;
  venue: string;
  startsAt: string; // datetime-local value
  endsAt: string;
  salesClose: string; // datetime-local; empty = sales stay open until door time
  price: string; // dollars, free text
  capacity: string;
}
const emptyDraft: Draft = {
  title: "",
  tagline: "",
  venue: "",
  startsAt: "",
  endsAt: "",
  salesClose: "",
  price: "",
  capacity: "",
};

/** datetime-local → ISO (browser-local wall time), "" → null. */
const toIso = (v: string): string | null => {
  if (!v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
/** ISO → datetime-local value in the browser's zone (for editing). */
const toLocal = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dollars = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

function whenLine(e: EventItem): string | null {
  if (!e.startsAt) return null;
  try {
    const tz = e.tz ?? undefined;
    const start = new Date(e.startsAt);
    const date = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: tz,
    }).format(start);
    const t = (d: Date) =>
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      }).format(d);
    return `${date} · ${t(start)}${e.endsAt ? ` – ${t(new Date(e.endsAt))}` : ""}`;
  } catch {
    return null;
  }
}

/** "Jul 18, 8:00 PM" (event-local) — the quiet sales-deadline note on a card. */
function salesCloseLine(e: EventItem): string | null {
  if (!e.salesCloseAt) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: e.tz ?? undefined,
    }).format(new Date(e.salesCloseAt));
  } catch {
    return null;
  }
}

const field =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-foreground placeholder:text-muted/40 transition focus:border-accent/40 focus:bg-white/[0.05]";
const label =
  "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60";

export default function EventsClient({
  initialEvents,
}: {
  initialEvents: EventItem[];
}) {
  const router = useRouter();
  const [events, setEvents] = useState(initialEvents);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); // event id
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [posterBusy, setPosterBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const posterTarget = useRef<string | null>(null);

  // THE TRAILER picker — the organizer's songs, then that song's ready loops.
  // Lazy: nothing loads until the sheet opens.
  const [mySongs, setMySongs] = useState<{ id: string; title: string }[] | null>(null);
  const [soundSongId, setSoundSongId] = useState("");
  const [soundParts, setSoundParts] = useState<{ id: string; label: string }[] | null>(null);
  const [soundPartId, setSoundPartId] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  // Mint the preview URL ONCE per file, not on every render (every keystroke in
  // the draft re-renders): a bare URL.createObjectURL in JSX leaked a blob URL —
  // and pinned the File in memory — on each render. Revoke on change/unmount.
  const posterUrl = useMemo(
    () => (posterFile ? URL.createObjectURL(posterFile) : null),
    [posterFile],
  );
  useEffect(() => {
    return () => {
      if (posterUrl) URL.revokeObjectURL(posterUrl);
    };
  }, [posterUrl]);
  const sheetPosterRef = useRef<HTMLInputElement>(null);
  async function loadSongs() {
    if (mySongs) return;
    try {
      const res = await fetch("/api/songs");
      const d = (await res.json().catch(() => ({}))) as {
        songs?: { id: string; title: string; status?: string }[];
      };
      setMySongs((d.songs ?? []).map((s) => ({ id: s.id, title: s.title })));
    } catch {
      setMySongs([]);
    }
  }
  async function pickSong(id: string) {
    setSoundSongId(id);
    setSoundPartId("");
    setSoundParts(null);
    if (!id) return;
    try {
      const res = await fetch(`/api/songs/${id}`, { cache: "no-store" });
      const d = openDeep(
        (await res.json().catch(() => null)) as {
          parts?: { id: string; label: string | null; status: string; strudel?: string | null }[];
        } | null,
      );
      setSoundParts(
        (d?.parts ?? [])
          .filter((p) => p.status === "ready" && p.strudel)
          .map((p) => ({ id: p.id, label: p.label || "untitled" })),
      );
    } catch {
      setSoundParts([]);
    }
  }

  // PAYOUTS (Stripe Connect) — null until known. GET also re-asks Stripe when
  // an account exists but isn't ready yet, so landing back from onboarding
  // (?connect=done) flips the state without any webhook dependency.
  const [payouts, setPayouts] = useState<{ connected: boolean; ready: boolean } | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  useEffect(() => {
    let dead = false;
    void fetch("/api/connect")
      .then((r) => r.json())
      .then((d: { connected?: boolean; ready?: boolean }) => {
        if (!dead) setPayouts({ connected: !!d.connected, ready: !!d.ready });
      })
      .catch(() => {});
    if (new URLSearchParams(location.search).has("connect")) {
      history.replaceState(null, "", "/events");
    }
    return () => {
      dead = true;
    };
  }, []);
  async function startConnect() {
    if (connectBusy) return;
    setConnectBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/connect", { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !d.url) {
        setError(d.error || "Stripe onboarding didn't start.");
        setConnectBusy(false);
        return;
      }
      location.href = d.url;
    } catch {
      setError("Network error.");
      setConnectBusy(false);
    }
  }

  const set = (k: keyof Draft) => (v: string) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function draftBody() {
    const priceCents = Math.round(parseFloat(draft.price || "0") * 100) || 0;
    const capacity = parseInt(draft.capacity, 10);
    return {
      title: draft.title.trim() || "untitled event",
      tagline: draft.tagline,
      venue: draft.venue,
      startsAt: toIso(draft.startsAt),
      endsAt: toIso(draft.endsAt),
      salesCloseAt: toIso(draft.salesClose),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      priceCents,
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
    };
  }

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        editing ? `/api/events/${editing}` : "/api/events",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draftBody()),
        },
      );
      const d = (await res.json().catch(() => ({}))) as {
        event?: { id: string; token: string };
        error?: string;
      };
      if (!res.ok || !d.event) {
        setError(d.error || "Couldn't save the event.");
        return;
      }
      // Poster + trailer land AFTER the row exists (create needs the id) —
      // both best-effort; the event stands either way.
      if (posterFile) {
        await fetch(`/api/events/${d.event.id}/poster`, {
          method: "PUT",
          headers: { "content-type": posterFile.type },
          body: posterFile,
        }).catch(() => {});
      }
      const original = editing
        ? (events.find((e) => e.id === editing)?.trackPartId ?? "")
        : "";
      if (soundPartId !== original) {
        await fetch(`/api/events/${d.event.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trackPartId: soundPartId || null }),
        }).catch(() => {});
      }
      setCreating(false);
      setEditing(null);
      setDraft(emptyDraft);
      setPosterFile(null);
      router.refresh();
      // Optimistic touch so the list feels instant while refresh lands.
      location.reload();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function openEdit(e: EventItem) {
    setEditing(e.id);
    setCreating(true);
    setPosterFile(null);
    setSoundSongId("");
    setSoundParts(null);
    setSoundPartId(e.trackPartId ?? "");
    void loadSongs();
    setDraft({
      title: e.title,
      tagline: e.tagline ?? "",
      venue: e.venue ?? "",
      startsAt: toLocal(e.startsAt),
      endsAt: toLocal(e.endsAt),
      salesClose: toLocal(e.salesCloseAt),
      price: e.priceCents ? String(e.priceCents / 100) : "",
      capacity: e.capacity ? String(e.capacity) : "",
    });
  }

  async function copyLink(e: EventItem) {
    const url = `${location.origin}/e/${e.token}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: e.title, url });
        return;
      }
    } catch {
      /* dismissed */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(e.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* denied */
    }
  }

  async function uploadPoster(file: File) {
    const id = posterTarget.current;
    if (!id) return;
    setPosterBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/events/${id}/poster`, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) setError(d.error || "Poster upload failed.");
      else location.reload();
    } catch {
      setError("Poster upload failed.");
    } finally {
      setPosterBusy(null);
    }
  }

  async function cancelEvent(e: EventItem) {
    if (!confirm(`Call off “${e.title}”? The page will say so.`)) return;
    await fetch(`/api/events/${e.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    }).catch(() => {});
    location.reload();
  }

  async function deleteEvent(e: EventItem) {
    if (!confirm(`Delete “${e.title}” for good? The link dies with it.`)) return;
    setEvents((list) => list.filter((x) => x.id !== e.id));
    await fetch(`/api/events/${e.id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-28 pt-6 sm:pt-8">
      {/* brand bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="wordmark text-[17px] tracking-tight text-foreground"
        >
          Klappn
        </Link>
        <Link
          href="/sets"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-1.5 text-[13px] font-medium text-foreground/80 transition hover:bg-white/[0.08]"
        >
          Sets
        </Link>
      </div>

      {/* header */}
      <header className="relative mt-14 flex items-end justify-between gap-4">
        <span
          aria-hidden
          className="glow-breathe pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full"
          style={{
            background:
              "radial-gradient(closest-side, rgba(224,49,156,.22), rgba(179,18,111,.08) 55%, transparent 72%)",
          }}
        />
        <div>
          <h1 className="wordmark text-gradient text-[34px] tracking-tight">
            Events
          </h1>
          <p className="mt-1.5 text-[14px] text-muted">
            Name a night. Share one link. Watch the room fill.
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => {
              setEditing(null);
              setDraft(emptyDraft);
              setPosterFile(null);
              setSoundSongId("");
              setSoundParts(null);
              setSoundPartId("");
              setCreating(true);
              setError(null);
              void loadSongs();
            }}
            className="btn-primary shrink-0 rounded-full px-5 py-2.5 text-[14px] font-semibold"
          >
            + New event
          </button>
        )}
      </header>

      {/* payouts — one quiet line, only while there's something to say */}
      {payouts && !payouts.ready && (
        <div className="animate-fade-in mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-3.5">
          <p className="text-[13px] text-muted">
            {payouts.connected
              ? "Stripe is still checking your details — payouts switch on the moment it clears."
              : "Ticket money, straight to your bank. Klappn keeps 10%, card fees included — the rest lands on its own."}
          </p>
          <button
            onClick={() => void startConnect()}
            disabled={connectBusy}
            className="shrink-0 rounded-full border border-accent/35 bg-accent/[0.08] px-4 py-1.5 text-[12.5px] font-semibold text-accent-strong transition hover:bg-accent/[0.16] disabled:opacity-50"
          >
            {connectBusy
              ? "Opening Stripe…"
              : payouts.connected
                ? "Finish setup"
                : "Set up payouts"}
          </button>
        </div>
      )}
      {payouts?.ready && (
        <div className="mt-6 flex items-center gap-2 px-1 text-[12px] text-muted/70">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,.5)]" />
          Payouts on — ticket money lands in your bank automatically.
        </div>
      )}

      {/* the create/edit sheet — one machined card */}
      {creating && (
        <section className="animate-fade-in mt-8 rounded-3xl border border-white/[0.09] bg-[#101115]/85 p-6 shadow-[0_30px_90px_-40px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.05)] backdrop-blur-xl">
          <div className="grid gap-4">
            <div>
              <label className={label}>The night</label>
              <input
                autoFocus
                value={draft.title}
                onChange={(e) => set("title")(e.target.value)}
                placeholder="name it something they'll repeat"
                className={field}
              />
            </div>
            <div>
              <label className={label}>One hot line</label>
              <input
                value={draft.tagline}
                onChange={(e) => set("tagline")(e.target.value)}
                placeholder="what happens when the lights drop (optional)"
                className={field}
              />
            </div>
            <div>
              <label className={label}>Where</label>
              <input
                value={draft.venue}
                onChange={(e) => set("venue")(e.target.value)}
                placeholder="the room, the roof, the address"
                className={field}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Doors</label>
                <input
                  type="datetime-local"
                  value={draft.startsAt}
                  onChange={(e) => set("startsAt")(e.target.value)}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Ends</label>
                <input
                  type="datetime-local"
                  value={draft.endsAt}
                  onChange={(e) => set("endsAt")(e.target.value)}
                  className={field}
                />
              </div>
            </div>
            {/* THE TRAILER + THE POSTER — what makes the page feel alive */}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <label className={label}>The sound (a loop of yours, on the page)</label>
                <select
                  value={soundSongId}
                  onChange={(e) => void pickSong(e.target.value)}
                  className={field}
                >
                  <option value="">
                    {soundPartId && !soundSongId
                      ? "attached — pick a song to change it"
                      : "no trailer — silence until the night"}
                  </option>
                  {(mySongs ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                {soundSongId && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {soundParts === null ? (
                      <span className="shimmer-text text-[12px]">opening the loops…</span>
                    ) : soundParts.length === 0 ? (
                      <span className="text-[12px] text-muted/60">no finished loops in that one yet</span>
                    ) : (
                      soundParts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setSoundPartId(soundPartId === p.id ? "" : p.id)}
                          className={`rounded-full border px-3 py-1 text-[12px] font-medium transition ${
                            soundPartId === p.id
                              ? "border-accent/50 bg-accent/[0.14] text-accent-strong"
                              : "border-white/[0.09] bg-white/[0.03] text-foreground/70 hover:text-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={label}>Poster</label>
                <button
                  type="button"
                  onClick={() => sheetPosterRef.current?.click()}
                  className="relative h-24 w-[72px] overflow-hidden rounded-xl border border-white/[0.08] bg-[#16111c] transition hover:border-accent/40"
                >
                  {posterFile && posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={posterUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-[20px] text-muted/40">
                      +
                    </span>
                  )}
                </button>
                <input
                  ref={sheetPosterRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) setPosterFile(f);
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className={label}>Ticket ($ · empty = free)</label>
                <input
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => set("price")(e.target.value)}
                  placeholder="0"
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Capacity (empty = open)</label>
                <input
                  inputMode="numeric"
                  value={draft.capacity}
                  onChange={(e) => set("capacity")(e.target.value)}
                  placeholder="∞"
                  className={field}
                />
              </div>
              <div>
                <label className={label}>Sales close (empty = door time)</label>
                <input
                  type="datetime-local"
                  value={draft.salesClose}
                  onChange={(e) => set("salesClose")(e.target.value)}
                  className={field}
                />
              </div>
            </div>
            {parseFloat(draft.price || "0") > 0 && (
              <p className="text-[12px] leading-relaxed text-muted/70">
                Tickets settle through Stripe. Klappn keeps 10%, card fees
                included — the rest is yours.
              </p>
            )}
            {error && <p className="text-[13px] text-red-400/90">{error}</p>}
            <div className="mt-1 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                  setError(null);
                }}
                className="rounded-full px-4 py-2 text-[13px] font-medium text-muted transition hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => void submit()}
                disabled={busy}
                className="btn-primary rounded-full px-6 py-2.5 text-[14px] font-semibold disabled:opacity-60"
              >
                {busy ? "Saving…" : editing ? "Save changes" : "Create the night"}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* hidden file input for poster uploads */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadPoster(f);
        }}
      />

      {/* the gallery */}
      <section className="mt-8 grid gap-4">
        {events.length === 0 && !creating && (
          <div className="rounded-3xl border border-dashed border-white/[0.1] px-6 py-14 text-center">
            <p className="text-[15px] text-muted">
              No nights on the books yet.
            </p>
            <p className="mt-1 text-[13px] text-muted/60">
              Make one — the link does the promoting.
            </p>
          </div>
        )}
        {events.map((e, i) => {
          const when = whenLine(e);
          const past = e.endsAt
            ? Date.parse(e.endsAt) < Date.now()
            : e.startsAt
              ? Date.parse(e.startsAt) + 3 * 3600_000 < Date.now()
              : false;
          const net = e.grossCents - e.feeCents;
          return (
            <article
              key={e.id}
              className="animate-rise group relative flex gap-4 rounded-3xl border border-white/[0.07] bg-[#0d0e12]/80 p-4 transition duration-300 hover:border-accent/25 hover:shadow-[0_0_44px_-16px_rgba(224,49,156,.5)]"
              style={{ ["--i" as string]: Math.min(i, 8) }}
            >
              {/* poster thumb / drop target */}
              <button
                onClick={() => {
                  posterTarget.current = e.id;
                  fileRef.current?.click();
                }}
                title={e.hasPoster ? "Swap the poster" : "Add a poster"}
                className="relative h-24 w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#16111c] transition hover:border-accent/40"
              >
                {e.hasPoster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/e/${e.token}/poster?v=${Date.parse(e.updatedAt) || 0}`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-[20px] text-muted/40">
                    {posterBusy === e.id ? "…" : "+"}
                  </span>
                )}
                {posterBusy === e.id && (
                  <span className="absolute inset-0 grid place-items-center bg-black/60 text-[11px] text-foreground">
                    <span className="shimmer-text">uploading</span>
                  </span>
                )}
              </button>

              {/* body */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <a
                      href={`/e/${e.token}`}
                      target="_blank"
                      className="block truncate text-[17px] font-semibold tracking-tight text-foreground transition hover:text-accent-strong"
                    >
                      {e.title}
                    </a>
                    <p className="mt-0.5 truncate text-[13px] text-muted">
                      {[when, e.venue].filter(Boolean).join(" — ") ||
                        "no time set yet"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      e.status === "cancelled"
                        ? "bg-white/[0.05] text-muted/70"
                        : past
                          ? "bg-white/[0.05] text-muted"
                          : e.priceCents > 0
                            ? "bg-accent/[0.12] text-accent-strong"
                            : "bg-white/[0.06] text-foreground/70"
                    }`}
                  >
                    {e.status === "cancelled"
                      ? "called off"
                      : past
                        ? "happened"
                        : e.priceCents > 0
                          ? dollars(e.priceCents)
                          : "free"}
                  </span>
                </div>

                {/* one meta line: the numbers that matter */}
                <p className="mt-2 text-[12.5px] text-muted/80">
                  <span className="font-medium text-foreground/85">
                    {e.confirmed}
                  </span>{" "}
                  {e.confirmed === 1 ? "person" : "people"} in
                  {e.capacity !== null && (
                    <span className="text-muted/60"> / {e.capacity}</span>
                  )}
                  {e.priceCents > 0 && e.grossCents > 0 && (
                    <>
                      {" "}
                      · <span className="font-medium text-foreground/85">
                        {dollars(net)}
                      </span>{" "}
                      yours
                    </>
                  )}
                  {salesCloseLine(e) && (
                    <span className="text-muted/60">
                      {" "}
                      · sales close {salesCloseLine(e)}
                    </span>
                  )}
                </p>

                {/* actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void copyLink(e)}
                    className="rounded-full border border-accent/35 bg-accent/[0.08] px-3.5 py-1.5 text-[12px] font-semibold text-accent-strong transition hover:bg-accent/[0.16]"
                  >
                    {copiedId === e.id ? "Copied" : "Share the link"}
                  </button>
                  <button
                    onClick={() => openEdit(e)}
                    className="rounded-full border border-white/[0.1] px-3.5 py-1.5 text-[12px] font-medium text-foreground/70 transition hover:bg-white/[0.06]"
                  >
                    Edit
                  </button>
                  {e.status === "live" && !past && (
                    <button
                      onClick={() => void cancelEvent(e)}
                      className="rounded-full px-3 py-1.5 text-[12px] text-muted/60 transition hover:text-foreground"
                    >
                      Call it off
                    </button>
                  )}
                  <button
                    onClick={() => void deleteEvent(e)}
                    className="rounded-full px-3 py-1.5 text-[12px] text-muted/40 transition hover:text-red-400/80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
