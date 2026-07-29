import { db } from "@/lib/db";
import { getUserId, unauthorized } from "@/lib/session";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { sealDeep } from "@/lib/seal";

export const dynamic = "force-dynamic";

/**
 * THE SHARE LINK (2026-07-29) — hand someone the code you're playing.
 *
 * Not the live door (that streams AUDIO over the SFU to /live/<token>, and it
 * ends when you stop). This is the other half of the same instinct: a frozen
 * copy of both panes that anyone can open, hear, and immediately change. The
 * token IS the permission — a share is public by construction, so GET takes no
 * session. Creating one does, so a link always has an author behind it.
 */

/** Short, URL-safe, unambiguous — no 0/O/1/l to misread down a phone line. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function mintToken(): string {
  const bytes = new Uint8Array(11);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  if (!(await rateLimit(`share:ip:${clientIp(req)}`, 20, 60))) return tooMany();

  const body = (await req.json().catch(() => null)) as {
    strudel?: unknown;
    hydra?: unknown;
  } | null;
  const strudel = typeof body?.strudel === "string" ? body.strudel.slice(0, 40000) : "";
  const hydra = typeof body?.hydra === "string" ? body.hydra.slice(0, 40000) : "";
  if (!strudel.trim() && !hydra.trim()) {
    return Response.json({ error: "nothing to share" }, { status: 400 });
  }

  const sql = db();
  const token = mintToken();
  await sql`
    insert into room_shares (token, user_id, strudel, hydra)
    values (${token}, ${userId}, ${strudel}, ${hydra})
  `;
  return Response.json({ token });
}

/** Open a share. No session: the token is the permission. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[a-z2-9]{11}$/.test(token)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (!(await rateLimit(`shareget:ip:${clientIp(req)}`, 120, 60))) return tooMany();

  const sql = db();
  const rows = (await sql`
    select strudel, hydra from room_shares where token = ${token} limit 1
  `) as { strudel: string; hydra: string }[];
  if (!rows.length) return Response.json({ error: "not found" }, { status: 404 });
  // Code leaves through the same seal every code-bearing route uses.
  return Response.json(sealDeep({ strudel: rows[0].strudel, hydra: rows[0].hydra }));
}
