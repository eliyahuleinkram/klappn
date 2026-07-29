import { redirect } from "next/navigation";

/**
 * THE OLD DOOR (2026-07-29) — the room is at /engine now. Every share link
 * ever minted points here (`/boiler-room?s=<token>`), and Reddit holds the
 * name too, so this is a permanent forward, not a stub: the QUERY travels
 * with it, or a shared snapshot would land on an empty bench.
 */
export default async function BoilerRoomMoved({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) for (const one of v) qs.append(k, one);
  }
  const q = qs.toString();
  redirect(q ? `/engine?${q}` : "/engine");
}
