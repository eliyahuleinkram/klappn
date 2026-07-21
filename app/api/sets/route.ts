import { createSet, entriesOf, listSets, type SetEntry } from "@/lib/sets";
import { getUserId, unauthorized } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The sets library, each row enriched with the titles of the songs it holds
 *  (resolved in one query) so the list page renders without N fetches. */
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const sets = await listSets(userId);
  const ids = [...new Set(sets.flatMap((s) => entriesOf(s.plan).map((e) => e.songId)))];
  const titles = new Map<string, string>();
  if (ids.length) {
    const sql = db();
    const rows = await sql<{ id: string; title: string }[]>`
      select id, title from songs where user_id = ${userId} and id in ${sql(ids)}`;
    for (const r of rows) titles.set(r.id, r.title);
  }
  return Response.json(
    {
      sets: sets.map((s) => {
        const entries = entriesOf(s.plan);
        return {
          id: s.id,
          title: s.title,
          updated_at: s.updated_at,
          songCount: entries.length,
          songTitles: entries
            .map((e) => titles.get(e.songId))
            .filter((t): t is string => !!t),
        };
      }),
    },
    { headers: { "cache-control": "no-store, no-cache, must-revalidate" } },
  );
}

/** Create a set — `{ title?, songIds? }`. Song ids are re-scoped on hydration,
 *  so a foreign id in the list simply never plays; no need to pre-verify here. */
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    songIds?: string[];
  };
  const entries: SetEntry[] = (Array.isArray(body.songIds) ? body.songIds : [])
    .filter((id): id is string => typeof id === "string")
    .slice(0, 50)
    .map((songId) => ({ id: crypto.randomUUID(), songId }));
  const set = await createSet(userId, body.title ?? "", entries);
  return Response.json({ set });
}
