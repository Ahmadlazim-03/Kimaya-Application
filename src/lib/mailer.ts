/**
 * Email sender — Gmail SMTP (nodemailer).
 *
 * Required environment variables:
 *   SMTP_HOST       e.g. "smtp.gmail.com"
 *   SMTP_PORT       e.g. "587" (STARTTLS) or "465" (SSL)
 *   SMTP_USER       Full Gmail address used as From
 *   SMTP_PASS       Gmail App Password (16-char) — NOT the normal password
 *   SMTP_FROM       Optional friendly From e.g. "Kimaya Management <no-reply@kimaya.com>"
 *
 * To create a Gmail App Password:
 *   1. Enable 2-Step Verification in your Google account
 *   2. Visit https://myaccount.google.com/apppasswords
 *   3. Generate a new app password for "Mail"
 *   4. Paste the 16-character code (no spaces) as SMTP_PASS
 */

import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

export function isMailerConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT || 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // SMTPS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

export async function sendMail(opts: {
  to: string; subject: string; html: string; text?: string;
}) {
  if (!isMailerConfigured()) {
    throw new Error("Mailer belum dikonfigurasi (SMTP_HOST/USER/PASS hilang)");
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  return getTransporter().sendMail({
    from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text,
  });
}

/** Themed HTML email shell — keep all our outgoing emails consistent. */
export function renderEmail(opts: { title: string; preheader?: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width">
<title>${opts.title}</title>
</head>
<body style="margin:0;padding:0;background:#FDFBF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#4a3829;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#fff;opacity:0;">${opts.preheader}</div>` : ""}
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,56,41,0.08);">
        <tr>
          <td style="padding:32px 32px 0 32px;text-align:center;">
            <div style="display:inline-block;width:48px;height:48px;border-radius:50%;background:#4A5D23;color:white;font-size:20px;font-weight:600;line-height:48px;">K</div>
            <h1 style="margin:16px 0 0 0;font-family:Georgia,serif;font-size:22px;color:#4a3829;">${opts.title}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 32px 32px;font-size:14px;line-height:1.65;color:#5a4a3a;">
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px 32px;border-top:1px solid #eee;color:#9a8b7a;font-size:11px;line-height:1.5;text-align:center;">
            Pesan ini dikirim otomatis oleh sistem Kimaya Management.<br>
            Jika Anda tidak meminta email ini, abaikan saja.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
