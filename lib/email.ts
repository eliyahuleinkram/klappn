/**
 * Email sending via the Cloudflare Email Service REST API.
 *
 * Cloudflare's newer Email Service exposes both a Workers binding (`env.EMAIL`)
 * and a REST endpoint. We use the REST endpoint because magic-link sending runs
 * inside the Next.js auth route handler, which — to stay framework-neutral — has
 * no access to Worker `env` bindings. The REST API is callable from any runtime
 * with a Bearer token, exactly like our Workflows trigger.
 *
 *   POST https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send
 *   Authorization: Bearer <token>   (token needs the email-sending permission)
 *
 * Required env:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_EMAIL_API_TOKEN   (falls back to CLOUDFLARE_API_TOKEN)
 *   EMAIL_FROM                   (an address on a domain verified in Cloudflare)
 *
 * When these aren't set (local dev), emailConfigured() is false and callers fall
 * back to logging — so dev needs no email setup.
 */

function emailToken(): string | undefined {
  return process.env.CLOUDFLARE_EMAIL_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
}

export function emailConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID && emailToken() && process.env.EMAIL_FROM,
  );
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(
  args: SendEmailArgs,
): Promise<{ sent: boolean; error?: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = emailToken();
  const from = process.env.EMAIL_FROM;
  if (!accountId || !token || !from) {
    return { sent: false, error: "cloudflare email not configured" };
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          to: args.to,
          from,
          subject: args.subject,
          html: args.html,
          text: args.text ?? stripHtml(args.html),
        }),
        // Never let a stalled connection hang the whole request.
        signal: AbortSignal.timeout(8000),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      errors?: unknown;
    };
    if (!res.ok || json.success === false) {
      return {
        sent: false,
        error: `cloudflare email ${res.status}: ${JSON.stringify(json.errors ?? json)}`,
      };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The magic-link sign-in email — a true extension of the app, not a system
 * afterthought. One machined card on the same deep-black canvas as the sign-in
 * page (#060708), lit by a single fuchsia bloom, carrying the one-pink gradient
 * button (#ff63c1 → #e0319c → #b3126f) with its machined top edge. The steel-K
 * mark is rebuilt in pure CSS so it renders even with images off.
 *
 * Built for real inboxes, not just a browser: table-only layout, all styles
 * inline, a bulletproof button (VML for Outlook + a solid #e0319c fallback
 * UNDER the gradient), zero <img>/SVG/data-URI dependence, dark-locked meta, a
 * hidden preheader, and a visible plaintext link. Copy seduces without lying —
 * true for a first-time signer-up and a returning one alike.
 */
export function magicLinkEmail(url: string): { subject: string; html: string; text: string } {
  const subject = "The room’s still warm";
  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Sign in to Klappn</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>*{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif !important;}</style>
<![endif]-->
<style>
  :root { color-scheme:dark; supported-color-schemes:dark; }
  body { margin:0 !important; padding:0 !important; width:100% !important; background:#060708 !important; }
  a { text-decoration:none; }
  .kl-btn:hover { filter:brightness(1.06); }
  .kl-raw:hover { color:#ff63c1 !important; }
  @media only screen and (max-width:520px){
    .kl-card { width:100% !important; }
    .kl-pad { padding-left:26px !important; padding-right:26px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; width:100%; background-color:#060708; color-scheme:dark;">

<!-- preheader: inbox preview, hidden in body -->
<span style="display:none !important; visibility:hidden; opacity:0; color:#060708; height:0; width:0; font-size:1px; line-height:1px; max-height:0; max-width:0; overflow:hidden; mso-hide:all;">One tap and the lights come up — your sign-in link's inside.</span>
<span style="display:none !important; visibility:hidden; opacity:0; color:#060708; height:0; width:0; font-size:1px; line-height:1px; max-height:0; max-width:0; overflow:hidden; mso-hide:all;">&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</span>

<!-- full-viewport black canvas -->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#060708" style="background-color:#060708; margin:0; padding:0;">
  <tr>
    <td align="center" style="padding:44px 16px 56px 16px;">

      <!--[if mso]><table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <!-- centered stage; max-width holds the single object -->
      <!-- FLUID-HYBRID width: the Gmail app strips <style> for non-Gmail accounts,
           so a fixed 480px card forces the viewport to zoom OUT on phones. 100% +
           inline max-width renders full-size everywhere; Outlook gets the fixed
           480 from the MSO conditional wrapper above. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="kl-card" style="width:100%; max-width:480px;">
        <tr>
          <td style="padding:0;">

            <!-- THE ONE OBJECT: a single machined card. bgcolor is the solid fallback; the pink bloom rides as a background-image over it and simply drops in Outlook. -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#101115" style="width:100%; background-color:#101115; background-image:radial-gradient(120% 78% at 50% -8%, rgba(224,49,156,0.20) 0%, rgba(179,18,111,0.07) 34%, rgba(16,17,21,0) 62%); border:1px solid #262830; border-radius:20px;">
              <tr>
                <td class="kl-pad" style="padding:44px 44px 34px 44px;">

                  <!-- mark: steel K on a violet-black tile with a hairline fuchsia edge -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td width="50" height="50" align="center" valign="middle" bgcolor="#190b20" style="width:50px; height:50px; background-color:#190b20; border:1px solid rgba(224,49,156,0.42); border-radius:14px; text-align:center; vertical-align:middle; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:27px; line-height:50px; mso-line-height-rule:exactly; font-weight:700; letter-spacing:-0.03em; color:#eef1f6;">K</td>
                    </tr>
                  </table>

                  <!-- kicker -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:30px 0 14px 0; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#e0319c; line-height:1; mso-line-height-rule:exactly;">Your way in</td>
                    </tr>
                  </table>

                  <!-- headline: the concrete, magnetic promise -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:0 4px 16px 4px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:27px; line-height:1.24; font-weight:600; letter-spacing:-0.025em; color:#f4f5f7;">The room&rsquo;s still warm.</td>
                    </tr>
                  </table>

                  <!-- hottest line, seated directly on the button -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:0 6px 30px 6px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:16px; line-height:1.55; font-weight:400; color:#8b8d98;">One tap and it starts to hum.</td>
                    </tr>
                  </table>

                  <!-- BULLETPROOF BUTTON -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td align="center" bgcolor="#e0319c" style="border-radius:12px; background-color:#e0319c;">
                        <!--[if mso]>
                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="24%" strokecolor="#b3126f" strokeweight="1px" fillcolor="#e0319c">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.01em;">Step inside</center>
                        </v:roundrect>
                        <![endif]-->
                        <!--[if !mso]><!-- -->
                        <a href="${url}" target="_blank" class="kl-btn" style="display:inline-block; min-width:170px; padding:15px 40px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; letter-spacing:-0.01em; line-height:20px; color:#ffffff; text-align:center; text-decoration:none; background-color:#e0319c; background-image:linear-gradient(135deg,#ff63c1 0%,#e0319c 55%,#b3126f 100%); border-radius:12px; border-top:1px solid rgba(255,255,255,0.22);">Step inside</a>
                        <!--<![endif]-->
                      </td>
                    </tr>
                  </table>

                  <!-- plaintext fallback link -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:26px 4px 4px 4px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.6; color:#6b6b73;">
                        Or paste this link into your browser:<br>
                        <a href="${url}" target="_blank" class="kl-raw" style="color:#8b8d98; text-decoration:underline; word-break:break-all;">${url}</a>
                      </td>
                    </tr>
                  </table>

                  <!-- hairline divider -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding:28px 0 0 0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr><td height="1" style="height:1px; line-height:1px; font-size:1px; background-color:#262830;">&nbsp;</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- quiet mechanics: footer friction -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:20px 4px 0 4px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; line-height:1.65; color:#6b6b73;">This link expires shortly and opens once. Didn&rsquo;t ask to sign in? Ignore it &mdash; nothing happens.</td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>
            <!-- /one object -->

            <!-- outside-the-card footer wordmark, faintest -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding:22px 0 0 0; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; font-weight:600; letter-spacing:-0.045em; color:#3f4048;">Klappn</td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->

    </td>
  </tr>
</table>

</body>
</html>`;
  const text = `The room's still warm.\n\nOne tap and it starts to hum. Step inside:\n${url}\n\n—\nThis link expires shortly and opens once. Didn't ask to sign in? Ignore it — nothing happens.\n\nKlappn`;
  return { subject, html, text };
}

/**
 * The sign-in CODE email — the browser-proof way in: six digits the user types
 * into the page they never left. Same machined card as the magic-link email
 * (one object, one pink, dark-locked, table-only, fluid-hybrid width); the code
 * IS the hero — huge, letter-spaced, selectable, in its own bordered tile.
 */
export function otpCodeEmail(otp: string): { subject: string; html: string; text: string } {
  const subject = `${otp} is your way in`;
  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Your code</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>*{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif !important;}</style>
<![endif]-->
<style>
  :root { color-scheme:dark; supported-color-schemes:dark; }
  body { margin:0 !important; padding:0 !important; width:100% !important; background:#060708 !important; }
  @media only screen and (max-width:520px){
    .kl-card { width:100% !important; }
    .kl-pad { padding-left:26px !important; padding-right:26px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; width:100%; background-color:#060708; color-scheme:dark;">
<span style="display:none !important; visibility:hidden; opacity:0; color:#060708; height:0; width:0; font-size:1px; line-height:1px; max-height:0; max-width:0; overflow:hidden; mso-hide:all;">${otp} — type it where you left off.</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#060708" style="background-color:#060708; margin:0; padding:0;">
  <tr>
    <td align="center" style="padding:44px 16px 56px 16px;">
      <!--[if mso]><table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="kl-card" style="width:100%; max-width:480px;">
        <tr>
          <td style="padding:0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#101115" style="width:100%; background-color:#101115; background-image:radial-gradient(120% 78% at 50% -8%, rgba(224,49,156,0.20) 0%, rgba(179,18,111,0.07) 34%, rgba(16,17,21,0) 62%); border:1px solid #262830; border-radius:20px;">
              <tr>
                <td class="kl-pad" style="padding:44px 44px 34px 44px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td width="50" height="50" align="center" valign="middle" bgcolor="#190b20" style="width:50px; height:50px; background-color:#190b20; border:1px solid rgba(224,49,156,0.42); border-radius:14px; text-align:center; vertical-align:middle; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:27px; line-height:50px; mso-line-height-rule:exactly; font-weight:700; letter-spacing:-0.03em; color:#eef1f6;">K</td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:30px 0 18px 0; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#e0319c; line-height:1; mso-line-height-rule:exactly;">Your code</td>
                    </tr>
                  </table>
                  <!-- THE CODE — selectable text in its own tile -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td align="center" bgcolor="#0b0913" style="background-color:#0b0913; border:1px solid rgba(224,49,156,0.35); border-radius:16px; padding:18px 30px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:38px; line-height:1.1; font-weight:700; letter-spacing:0.28em; color:#f4f5f7;">${otp}</td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:22px 6px 0 6px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; line-height:1.55; color:#8b8d98;">Type it where you left off — it opens the door there.</td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="padding:28px 0 0 0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr><td height="1" style="height:1px; line-height:1px; font-size:1px; background-color:#262830;">&nbsp;</td></tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:20px 4px 0 4px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; line-height:1.65; color:#6b6b73;">It expires shortly. Didn&rsquo;t ask to sign in? Ignore it &mdash; nothing happens.</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding:22px 0 0 0; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; font-weight:600; letter-spacing:-0.045em; color:#3f4048;">Klappn</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
  const text = `Your Klappn sign-in code: ${otp}\n\nType it where you left off — it opens the door there.\n\nIt expires shortly. Didn't ask to sign in? Ignore it — nothing happens.\n\nKlappn`;
  return { subject, html, text };
}

/**
 * The event-ticket confirmation — the SAME machined card as the magic-link
 * email (one object, one pink, dark-locked, table-only), carrying the event's
 * name, when and where, and one gradient button back to the page. Sent on a
 * free RSVP and on a confirmed paid ticket alike; the paid variant names the
 * amount so the receipt is honest.
 */
export function eventTicketEmail(
  event: {
    title: string;
    tagline: string | null;
    venue: string | null;
    starts_at: string | null;
    ends_at: string | null;
    tz: string | null;
  },
  url: string,
  amountCents: number,
): { subject: string; html: string; text: string } {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Inline (not imported) so this module stays dependency-free for the auth handler.
  let when = "";
  if (event.starts_at) {
    try {
      const tz = event.tz ?? "UTC";
      const start = new Date(event.starts_at);
      const date = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: tz,
      }).format(start);
      const t = (d: Date) =>
        new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(d);
      when = `${date} · ${t(start)}${event.ends_at ? ` – ${t(new Date(event.ends_at))}` : ""}`;
    } catch {
      /* leave when empty */
    }
  }
  const subject = "You’re in.";
  const paidLine =
    amountCents > 0
      ? `Your ticket — $${(amountCents / 100).toFixed(2)} — is tied to this email. Just show up.`
      : "Your spot is tied to this email. Just show up.";
  const metaRow = (label: string, value: string) => `
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:0 6px 8px 6px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:14px; line-height:1.5; color:#8b8d98;"><span style="color:#e0319c; font-size:11px; font-weight:600; letter-spacing:0.16em; text-transform:uppercase;">${label}</span>&nbsp;&nbsp;<span style="color:#f4f5f7;">${value}</span></td>
                    </tr>
                  </table>`;
  const html = `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>You&rsquo;re in</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>*{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif !important;}</style>
<![endif]-->
<style>
  :root { color-scheme:dark; supported-color-schemes:dark; }
  body { margin:0 !important; padding:0 !important; width:100% !important; background:#060708 !important; }
  a { text-decoration:none; }
  .kl-btn:hover { filter:brightness(1.06); }
  @media only screen and (max-width:520px){
    .kl-card { width:100% !important; }
    .kl-pad { padding-left:26px !important; padding-right:26px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; width:100%; background-color:#060708; color-scheme:dark;">
<span style="display:none !important; visibility:hidden; opacity:0; color:#060708; height:0; width:0; font-size:1px; line-height:1px; max-height:0; max-width:0; overflow:hidden; mso-hide:all;">${esc(event.title)} — you&rsquo;re on the list.</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#060708" style="background-color:#060708; margin:0; padding:0;">
  <tr>
    <td align="center" style="padding:44px 16px 56px 16px;">
      <!--[if mso]><table role="presentation" align="center" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <!-- FLUID-HYBRID width: the Gmail app strips <style> for non-Gmail accounts,
           so a fixed 480px card forces the viewport to zoom OUT on phones. 100% +
           inline max-width renders full-size everywhere; Outlook gets the fixed
           480 from the MSO conditional wrapper above. -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="kl-card" style="width:100%; max-width:480px;">
        <tr>
          <td style="padding:0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#101115" style="width:100%; background-color:#101115; background-image:radial-gradient(120% 78% at 50% -8%, rgba(224,49,156,0.20) 0%, rgba(179,18,111,0.07) 34%, rgba(16,17,21,0) 62%); border:1px solid #262830; border-radius:20px;">
              <tr>
                <td class="kl-pad" style="padding:44px 44px 34px 44px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td width="50" height="50" align="center" valign="middle" bgcolor="#190b20" style="width:50px; height:50px; background-color:#190b20; border:1px solid rgba(224,49,156,0.42); border-radius:14px; text-align:center; vertical-align:middle; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:27px; line-height:50px; mso-line-height-rule:exactly; font-weight:700; letter-spacing:-0.03em; color:#eef1f6;">K</td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:30px 0 14px 0; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#e0319c; line-height:1; mso-line-height-rule:exactly;">You&rsquo;re in</td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:0 4px 16px 4px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:27px; line-height:1.24; font-weight:600; letter-spacing:-0.025em; color:#f4f5f7;">${esc(event.title)}</td>
                    </tr>
                  </table>
${when ? metaRow("When", esc(when)) : ""}${event.venue ? metaRow("Where", esc(event.venue)) : ""}
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:12px 6px 30px 6px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; line-height:1.55; font-weight:400; color:#8b8d98;">${paidLine}</td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                    <tr>
                      <td align="center" bgcolor="#e0319c" style="border-radius:12px; background-color:#e0319c;">
                        <!--[if mso]>
                        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:50px;v-text-anchor:middle;width:250px;" arcsize="24%" strokecolor="#b3126f" strokeweight="1px" fillcolor="#e0319c">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:-0.01em;">The event page</center>
                        </v:roundrect>
                        <![endif]-->
                        <!--[if !mso]><!-- -->
                        <a href="${url}" target="_blank" class="kl-btn" style="display:inline-block; min-width:170px; padding:15px 40px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; letter-spacing:-0.01em; line-height:20px; color:#ffffff; text-align:center; text-decoration:none; background-color:#e0319c; background-image:linear-gradient(135deg,#ff63c1 0%,#e0319c 55%,#b3126f 100%); border-radius:12px; border-top:1px solid rgba(255,255,255,0.22);">The event page</a>
                        <!--<![endif]-->
                      </td>
                    </tr>
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td align="center" style="padding:26px 4px 4px 4px; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:12px; line-height:1.6; color:#6b6b73;">
                        Add it to your calendar from the event page &mdash; and bring the loud ones.<br>
                        <a href="${url}" target="_blank" style="color:#8b8d98; text-decoration:underline; word-break:break-all;">${url}</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td align="center" style="padding:22px 0 0 0; font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:11px; font-weight:600; letter-spacing:-0.045em; color:#3f4048;">Klappn</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
  const text = `You're in — ${event.title}\n${when ? `When: ${when}\n` : ""}${event.venue ? `Where: ${event.venue}\n` : ""}\n${paidLine}\n\n${url}\n\nKlappn`;
  return { subject, html, text };
}
