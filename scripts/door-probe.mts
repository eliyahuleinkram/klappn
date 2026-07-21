import postgres from "postgres";
import { buildPlayEntry } from "../lib/home-sections";
const sql = postgres("postgres://localhost/klappn");
const songs = await sql`select id, title, plan from songs where featured_at is not null`;
for (const s of songs) {
  const parts = await sql`select id, label, strudel, status from parts where song_id = ${s.id} order by position`;
  try {
    const e = buildPlayEntry(parts as any, (s.plan ?? {}) as any);
    console.log(s.title, "→", e ? `${e.sections.length} sections, visual=${e.visual}, secs=${e.sections.map((x:any)=>x.seconds.toFixed(1)).join(",")}` : "NULL ENTRY");
  } catch (err) {
    console.log(s.title, "THREW:", (err as Error).message);
  }
}
await sql.end();
