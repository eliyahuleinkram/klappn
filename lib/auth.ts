import { betterAuth } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";
import { Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import { getSql, hasConnectionString } from "./db";
import { emailConfigured, magicLinkEmail, otpCodeEmail, sendEmail } from "./email";

/**
 * Better Auth server instance — built PER REQUEST via getAuth().
 *
 * Two Cloudflare Workers constraints shape this:
 *
 * 1. We must NOT construct the DB client or call betterAuth() at module
 *    top-level. The runtime evaluates global scope during a startup probe where
 *    the Hyperdrive binding isn't safely available — doing DB work there fails
 *    worker startup (error 10021). So it's all deferred to request time.
 *
 * 2. We must NOT cache the Better Auth instance across requests. Its Kysely
 *    dialect captures a postgres.js client (via getSql()), and a connection
 *    created in one request CANNOT be used from another ("Cannot perform I/O on
 *    behalf of a different request" / the query hangs forever). So getAuth()
 *    builds a fresh instance each call, binding to the CURRENT request's scoped
 *    client (see lib/db.ts → runWithDbScope). Building betterAuth() does no I/O,
 *    so this is cheap.
 *
 * Better Auth owns and migrates its own tables (including the "user" table our
 * schema references). On Workers the connection string comes from Hyperdrive.
 */

function createAuth() {
  // Only build the Kysely instance when a connection string exists, so the app
  // can still render (e.g. the sign-in page) before the DB is configured.
  const database = hasConnectionString()
    ? new Kysely({ dialect: new PostgresJSDialect({ postgres: getSql() }) })
    : undefined;

  return betterAuth({
    database: database ? { db: database, type: "postgres" } : undefined,
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
    secret: process.env.BETTER_AUTH_SECRET,
    plugins: [
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          // Production: send via the Cloudflare Email Service (REST). Local dev
          // (no Cloudflare email env set): log the link to the server console so
          // sign-in works without any email setup.
          if (emailConfigured()) {
            const { subject, html, text } = magicLinkEmail(url);
            const { sent, error } = await sendEmail({ to: email, subject, html, text });
            if (sent) return;
            console.error(
              `[klappn] magic-link email failed (${error}); falling back to log`,
            );
          }
          console.log(`[klappn] magic link for ${email}: ${url}`);
        },
      }),
      // THE PRIMARY sign-in (2026-07-10): a 6-digit code the user TYPES into the
      // browser they started in. A magic link opens in the DEFAULT browser —
      // start in Chrome, tap in Gmail, land signed-in in Safari while Chrome
      // waits forever. A code has no browser: the session is always created
      // exactly where the user is. (magicLink stays wired above so any link
      // already in an inbox keeps working.)
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        async sendVerificationOTP({ email, otp }) {
          if (emailConfigured()) {
            const { subject, html, text } = otpCodeEmail(otp);
            const { sent, error } = await sendEmail({ to: email, subject, html, text });
            if (sent) return;
            console.error(
              `[klappn] otp email failed (${error}); falling back to log`,
            );
          }
          console.log(`[klappn] sign-in code for ${email}: ${otp}`);
        },
      }),
    ],
  });
}

/**
 * Build a Better Auth instance bound to the current request's DB scope.
 * Never cache the result across requests — see the note above.
 */
export function getAuth(): ReturnType<typeof createAuth> {
  return createAuth();
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
