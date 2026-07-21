import { warmPool } from "@/lib/db";
import { getLiveBundle } from "@/lib/live";
import { sealDeep } from "@/lib/seal";
import LiveListenClient from "@/components/LiveListenClient";

export const dynamic = "force-dynamic";

/** PUBLIC — no account, no session: the token in the URL is the invitation.
 *  Anyone the DJ hands this link can put their headphones in and be there. */
export default async function LivePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data: Awaited<ReturnType<typeof getLiveBundle>> = null;
  try {
    await warmPool();
    data = await getLiveBundle(token);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <h1 className="wordmark text-gradient text-[34px] tracking-tight">
          This set has ended.
        </h1>
        <p className="mt-3 text-[14px] text-muted">
          The link was for a live moment — and it passed.
        </p>
      </main>
    );
  }

  // Loop code crosses to the (PUBLIC) listener page sealed (see lib/seal.ts) —
  // LiveListenClient opens it on arrival.
  return (
    <LiveListenClient
      token={token}
      setTitle={data.bundle.set.title}
      expiresAt={data.link.expires_at}
      entries={
        ((data.bundle.set.plan ?? {}) as { entries?: { id: string; songId: string }[] })
          .entries ?? []
      }
      transitions={sealDeep(
        ((data.bundle.set.plan ?? {}) as {
          transitions?: Record<
            string,
            { options: { label: string; strudel: string }[]; chosen: number | null }
          >;
        }).transitions ?? {},
      )}
      songs={sealDeep(data.bundle.songs)}
    />
  );
}
