// lib/email.ts
// Email sending via SMTP (nodemailer).
//
// Required env vars (set all to enable real email):
//   SMTP_HOST   — e.g. "smtp.sendgrid.net" or "smtp.gmail.com"
//   SMTP_PORT   — e.g. "587" (TLS) or "465" (SSL)
//   SMTP_USER   — SMTP username / API key username
//   SMTP_PASS   — SMTP password / API key
//   SMTP_FROM   — Sender address, e.g. "no-reply@youragency.com"
//
// If any of those are missing the email is NOT sent. Instead:
//   - The reset URL is logged to the server console.
//   - `devUrl` is returned so the UI can show the link directly.
//   This makes the feature fully usable in development without an email account.

import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}

export interface EmailResult {
  /** true = email was dispatched via SMTP */
  sent: boolean;
  /**
   * Populated only when SMTP is not configured.
   * The caller can expose this URL in the UI for dev/testing purposes.
   */
  devUrl?: string;
}

function isConfigured() {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
  );
}

export async function sendEmail(opts: SendEmailOptions): Promise<EmailResult> {
  if (!isConfigured()) {
    // Dev fallback — surface the link text for the UI to display
    console.log("[email] SMTP not configured. Would have sent:");
    console.log(`  To: ${opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Body: ${opts.text}`);
    return { sent: false, devUrl: opts.text };
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT!, 10),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from:    process.env.SMTP_FROM,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text,
  });

  return { sent: true };
}
