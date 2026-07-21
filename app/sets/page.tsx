import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { db, warmPool } from "@/lib/db";
import { entriesOf, listSets } from "@/lib/sets";
import SetsClient from "@/components/SetsClient";

export const dynamic = "force-dynamic";

export default async function SetsPage() {
  let userId: string | null = null;
  try {
    await warmPool(); // Kysely reserve() hangs cold on Hyperdrive — see lib/db.ts
    const session = await getAuth().api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) redirect("/");

  const sets = await listSets(userId);
  const ids = [...new Set(sets.flatMap((s) => entriesOf(s.plan).map((e) => e.songId)))];
  const titles = new Map<string, string>();
  if (ids.length) {
    const sql = db();
    const rows = await sql<{ id: string; title: string }[]>`
      select id, title from songs where user_id = ${userId} and id in ${sql(ids)}`;
    for (const r of rows) titles.set(r.id, r.title);
  }

  return (
    <SetsClient
      initialSets={sets.map((s) => {
        const entries = entriesOf(s.plan);
        return {
          id: s.id,
          title: s.title,
          songCount: entries.length,
          songTitles: entries
            .map((e) => titles.get(e.songId))
            .filter((t): t is string => !!t),
        };
      })}
    />
  );
}
