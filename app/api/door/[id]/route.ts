import { getDoorSongWithParts } from "@/lib/songs";
import { sealDeep } from "@/lib/seal";

/**
 * THE DOOR, play side — one featured song's parts + slimmed plan, exactly what
 * lib/home-sections needs and nothing more. Public, but only for songs the
 * owner put on the door (a de-featured id 404s again), and the code crosses
 * the wire SEALED like every code-bearing route (lib/seal.ts).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getDoorSongWithParts(id).catch(() => null);
  if (!result) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(sealDeep(result), {
    headers: { "cache-control": "public, max-age=60, s-maxage=300" },
  });
}
