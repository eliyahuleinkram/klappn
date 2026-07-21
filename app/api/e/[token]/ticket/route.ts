import { ticketBySession } from "@/lib/events";

export const dynamic = "force-dynamic";

/** PUBLIC — the post-payment "am I in?" check. The Stripe session id (only the
 *  buyer's browser has it, via the success redirect) is the credential. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  await params;
  const session = new URL(req.url).searchParams.get("session") || "";
  if (!session) return Response.json({ error: "no session" }, { status: 400 });
  const ticket = await ticketBySession(session).catch(() => null);
  return Response.json(
    { status: ticket?.status ?? "unknown" },
    { headers: { "cache-control": "no-store" } },
  );
}
