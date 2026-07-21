import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { warmPool } from "@/lib/db";
import { getSetHydrated } from "@/lib/sets";
import { sealDeep } from "@/lib/seal";
import SetClient from "@/components/SetClient";

export const dynamic = "force-dynamic";

export default async function SetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let userId: string | null = null;
  try {
    await warmPool(); // Kysely reserve() hangs cold on Hyperdrive — see lib/db.ts
    const session = await getAuth().api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) redirect("/");

  const bundle = await getSetHydrated(id, userId);
  if (!bundle) notFound();

  // Loop code crosses to the client sealed (see lib/seal.ts) — SetClient opens it.
  return (
    <SetClient
      setId={id}
      initialSet={sealDeep(bundle.set)}
      initialSongs={sealDeep(bundle.songs)}
    />
  );
}
