import {
  deleteSet,
  getSetHydrated,
  setSetEntries,
  setSetTitle,
  setSetTransitionChoice,
  type SetEntry,
} from "@/lib/sets";
import { getUserId, unauthorized } from "@/lib/session";
import { sealDeep } from "@/lib/seal";

export const dynamic = "force-dynamic";

/** The whole set in one payload: the row + every referenced song with its parts
 *  (what set playback needs). Ownership-scoped; unknown/foreign ids read 404. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const bundle = await getSetHydrated(id, userId);
  if (!bundle) return Response.json({ error: "not found" }, { status: 404 });
  // Loop code crosses the wire sealed (see lib/seal.ts) — the client opens it.
  return Response.json(sealDeep(bundle), {
    headers: { "cache-control": "no-store, no-cache, must-revalidate" },
  });
}

// Mutate a set. One of:
//   { title }                                  — rename
//   { entries: [{id, songId}] }                — the arrangement (add/remove/reorder)
//   { transitionChoice: { fromEntryId, choice } } — which hand-off a boundary wears (null = cut)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    entries?: SetEntry[];
    transitionChoice?: { fromEntryId?: string; choice?: number | null };
  } | null;
  if (!body) return Response.json({ error: "bad request" }, { status: 400 });

  if (Array.isArray(body.entries)) {
    const entries = body.entries
      .filter((e) => e && typeof e.id === "string" && typeof e.songId === "string")
      .slice(0, 50)
      .map((e) => ({ id: e.id, songId: e.songId }));
    const ok = await setSetEntries(id, userId, entries);
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (body.transitionChoice && typeof body.transitionChoice.fromEntryId === "string") {
    const ok = await setSetTransitionChoice(
      id,
      userId,
      body.transitionChoice.fromEntryId,
      typeof body.transitionChoice.choice === "number"
        ? body.transitionChoice.choice
        : null,
    );
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  if (typeof body.title === "string") {
    const ok = await setSetTitle(id, userId, body.title);
    if (!ok) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "nothing to update" }, { status: 400 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();
  const { id } = await params;
  const ok = await deleteSet(id, userId);
  if (!ok) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ ok: true });
}
