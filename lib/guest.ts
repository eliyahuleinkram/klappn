import type { Sql } from "postgres";
import { db } from "./db";

/**
 * GUESTS ARE REAL USERS (2026-07-26, the try-before-any-account pivot): the
 * Better Auth anonymous plugin mints an actual "user" row + session for a
 * visitor who starts making before signing up, so every owned table (songs,
 * sets, sketches, usage) works unchanged — the quota gate included. Nothing is
 * given away: the models are bought, by a guest and an account alike
 * (2026-08-02, the taste was removed).
 *
 * When the guest later signs in with a real email, Better Auth links the two
 * and then DELETES the anonymous user — which would cascade-delete everything
 * they made. This merge runs first (auth.ts → onLinkAccount) and carries the
 * work + the meters over, in ONE transaction:
 *
 *  - content moves owner: songs, sets, sketches, vocal_takes, events, live_links
 *  - token_usage merges by (user, period) sum — spend follows the person
 *  - token_credits / token_reservations move (guests can't buy today, but a
 *    ledger row must never die in a cascade)
 *  - user_billing moves only when the account has no row of its own
 *
 * On error this THROWS: the sign-in fails loudly and the guest session (and
 * their work) survives for a retry — silent data loss is the one unacceptable
 * outcome.
 */
export async function mergeGuestAccount(
  fromUserId: string,
  toUserId: string,
): Promise<void> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;
  await db().begin(async (tx) => {
    const sql = tx as unknown as Sql;
    await sql`update songs set user_id = ${toUserId} where user_id = ${fromUserId}`;
    await sql`update sets set user_id = ${toUserId} where user_id = ${fromUserId}`;
    await sql`update sketches set user_id = ${toUserId} where user_id = ${fromUserId}`;
    await sql`update vocal_takes set user_id = ${toUserId} where user_id = ${fromUserId}`;
    await sql`update events set user_id = ${toUserId} where user_id = ${fromUserId}`;
    await sql`update live_links set user_id = ${toUserId} where user_id = ${fromUserId}`;
    // Usage merges: bought credits meter against LIFETIME usage, so a guest's
    // spend must land on the account or the balance would refill.
    await sql`
      insert into token_usage (user_id, period, tokens)
      select ${toUserId}, period, tokens from token_usage where user_id = ${fromUserId}
      on conflict (user_id, period) do update
      set tokens = token_usage.tokens + excluded.tokens`;
    await sql`delete from token_usage where user_id = ${fromUserId}`;
    await sql`update token_reservations set user_id = ${toUserId} where user_id = ${fromUserId}`;
    await sql`update token_credits set user_id = ${toUserId} where user_id = ${fromUserId}`;
    await sql`
      update user_billing set user_id = ${toUserId}
      where user_id = ${fromUserId}
        and not exists (select 1 from user_billing where user_id = ${toUserId})`;
    await sql`delete from user_billing where user_id = ${fromUserId}`;
  });
}
