// lib/notifications/templates.ts
// Pure email template builders — no DB access, no side effects.
// Uses inline styles for email client compatibility (Gmail, Outlook, Apple Mail).

import type { AlertEventRow }   from "../alerts/types";
import type { DigestContent }   from "./types";

// ── Shared styles ─────────────────────────────────────────────────────────────

const BODY_STYLE  = `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f172a; color: #cbd5e1; margin: 0; padding: 0;`;
const CARD_STYLE  = `background: #1e293b; border-radius: 12px; padding: 24px;
  max-width: 560px; margin: 32px auto;`;
const H1_STYLE    = `color: #f8fafc; font-size: 20px; font-weight: 600;
  margin: 0 0 8px 0; padding: 0;`;
const MUTED_STYLE = `color: #64748b; font-size: 13px; margin: 0 0 20px 0;`;
const LABEL_STYLE = `color: #94a3b8; font-size: 12px; text-transform: uppercase;
  letter-spacing: 0.08em; font-weight: 500; margin: 0 0 4px 0;`;
const VALUE_STYLE = `color: #e2e8f0; font-size: 14px; margin: 0 0 16px 0;`;
const HR_STYLE    = `border: none; border-top: 1px solid #334155; margin: 20px 0;`;
const FOOTER_STYLE = `color: #475569; font-size: 12px; text-align: center;
  margin-top: 20px;`;
const BTN_STYLE   = `display: inline-block; background: #059669; color: #ffffff;
  text-decoration: none; padding: 10px 20px; border-radius: 8px;
  font-size: 14px; font-weight: 500; margin-top: 16px;`;

function severityColor(severity: string): string {
  if (severity === "high")   return "#f43f5e";
  if (severity === "medium") return "#f59e0b";
  return "#64748b";
}

function priorityLabel(severity: string): string {
  return severity === "high"   ? "HIGH PRIORITY"   :
         severity === "medium" ? "MEDIUM PRIORITY" : "LOW PRIORITY";
}

// ── Immediate alert email ─────────────────────────────────────────────────────

export function buildImmediateAlertEmail(
  alert:    AlertEventRow,
  userName: string | null
): { subject: string; html: string; text: string } {
  const color   = severityColor(alert.severity);
  const pLabel  = priorityLabel(alert.severity);
  const greeting = userName ? `Hi ${userName},` : "Hi there,";
  const appUrl   = process.env.NEXTAUTH_URL ?? "https://your-dashboard.vercel.app";

  const subject = `[${pLabel}] ${alert.summary}`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BODY_STYLE}">
  <div style="${CARD_STYLE}">
    <div style="display:inline-block;background:${color}22;color:${color};
      font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;
      padding:4px 10px;border-radius:999px;margin-bottom:16px;">
      ${pLabel}
    </div>
    <h1 style="${H1_STYLE}">Alert Detected</h1>
    <p style="${MUTED_STYLE}">${greeting} A new alert requires your attention.</p>

    <p style="${LABEL_STYLE}">Alert</p>
    <p style="${VALUE_STYLE}">${alert.summary}</p>

    <p style="${LABEL_STYLE}">Client</p>
    <p style="${VALUE_STYLE}">${alert.clientName}</p>

    <p style="${LABEL_STYLE}">Entity</p>
    <p style="${VALUE_STYLE}">${alert.entityName}${alert.entityType !== "client" ? ` (${alert.entityType})` : ""}</p>

    <p style="${LABEL_STYLE}">Detected</p>
    <p style="${VALUE_STYLE}">${new Date(alert.detectedAt).toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    })}</p>

    <hr style="${HR_STYLE}">
    <a href="${appUrl}/alerts" style="${BTN_STYLE}">Review in Dashboard →</a>
    <p style="${FOOTER_STYLE}">
      Media Buying Dashboard · Alert notifications<br>
      This alert was generated automatically. No action has been taken in Meta.<br>
      <a href="${appUrl}/notifications" style="color:#475569;">Manage notification preferences</a>
    </p>
  </div>
</body>
</html>`;

  const text = [
    `[${pLabel}] Alert: ${alert.summary}`,
    "",
    `${greeting}`,
    "",
    `Alert:   ${alert.summary}`,
    `Client:  ${alert.clientName}`,
    `Entity:  ${alert.entityName}`,
    `Detected: ${new Date(alert.detectedAt).toLocaleString()}`,
    "",
    `Review: ${appUrl}/alerts`,
    `Manage notifications: ${appUrl}/notifications`,
  ].join("\n");

  return { subject, html, text };
}

// ── Daily digest email ────────────────────────────────────────────────────────

function digestSection(
  title: string,
  items: DigestContent["campaignsBelowGoal"],
  accentColor = "#94a3b8"
): string {
  if (items.length === 0) return "";

  const rows = items.map(
    (item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
        <div style="color:#e2e8f0;font-size:14px;font-weight:500;">${item.label}</div>
        <div style="color:#64748b;font-size:12px;margin-top:2px;">${item.detail}</div>
      </td>
      <td style="padding:8px 0 8px 16px;border-bottom:1px solid #1e293b;
        text-align:right;white-space:nowrap;">
        <span style="color:#94a3b8;font-size:12px;">${item.client}</span>
      </td>
    </tr>`
  ).join("");

  return `
  <div style="margin-bottom:24px;">
    <div style="color:${accentColor};font-size:11px;font-weight:600;
      text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">
      ${title}
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>
  </div>`;
}

export function buildDailyDigestEmail(
  digest:   DigestContent,
  userName: string | null
): { subject: string; html: string; text: string } {
  const date      = new Date(digest.generatedAt).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const greeting  = userName ? `Hi ${userName},` : "Hi there,";
  const appUrl    = process.env.NEXTAUTH_URL ?? "https://your-dashboard.vercel.app";
  const subject   = `Media Buying Daily Digest — ${date}`;

  const allClearSection = !digest.hasContent
    ? `<p style="color:#6ee7b7;font-size:14px;text-align:center;padding:20px 0;">
        ✓ Everything looks healthy today. No issues to report.
       </p>`
    : "";

  const sectionsHtml = [
    digestSection("Campaigns Below Goal",   digest.campaignsBelowGoal, "#f43f5e"),
    digestSection("Pacing Issues",           digest.pacingIssues,       "#f59e0b"),
    digestSection("Stale Syncs",             digest.staleSyncs,         "#fb923c"),
    digestSection("Top Opportunities",       digest.topOpportunities,   "#34d399"),
    digestSection("Missing Goals",           digest.missingGoals,       "#818cf8"),
  ].filter(Boolean).join("");

  const totalItems =
    digest.campaignsBelowGoal.length +
    digest.pacingIssues.length +
    digest.staleSyncs.length +
    digest.topOpportunities.length +
    digest.missingGoals.length;

  const summaryLine = digest.hasContent
    ? `${totalItems} item${totalItems !== 1 ? "s" : ""} need your attention today.`
    : "All clear — no issues detected today.";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BODY_STYLE}">
  <div style="${CARD_STYLE}">
    <div style="display:inline-block;background:#0f172a;color:#94a3b8;
      font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;
      padding:4px 10px;border-radius:999px;margin-bottom:16px;border:1px solid #334155;">
      DAILY DIGEST
    </div>
    <h1 style="${H1_STYLE}">Daily Summary</h1>
    <p style="${MUTED_STYLE}">${greeting} ${summaryLine}</p>
    <p style="color:#94a3b8;font-size:12px;margin:0 0 20px 0;">
      ${date}
    </p>
    <hr style="${HR_STYLE}">

    ${allClearSection}
    ${sectionsHtml}

    <hr style="${HR_STYLE}">
    <a href="${appUrl}/operations" style="${BTN_STYLE}">Open Operations Dashboard →</a>
    <p style="${FOOTER_STYLE}">
      Media Buying Dashboard · Daily digest<br>
      Actions are recommendations only — nothing is executed automatically.<br>
      <a href="${appUrl}/notifications" style="color:#475569;">Manage notification preferences</a>
    </p>
  </div>
</body>
</html>`;

  const textLines: string[] = [
    `Media Buying Daily Digest — ${date}`,
    "=".repeat(50),
    "",
    `${greeting}`,
    summaryLine,
    "",
  ];

  function textSection(title: string, items: DigestContent["campaignsBelowGoal"]) {
    if (!items.length) return;
    textLines.push(`── ${title} ──`);
    items.forEach((i) => textLines.push(`  • ${i.label} (${i.client}): ${i.detail}`));
    textLines.push("");
  }

  textSection("Campaigns Below Goal",  digest.campaignsBelowGoal);
  textSection("Pacing Issues",          digest.pacingIssues);
  textSection("Stale Syncs",            digest.staleSyncs);
  textSection("Top Opportunities",      digest.topOpportunities);
  textSection("Missing Goals",          digest.missingGoals);

  textLines.push(`Open dashboard: ${appUrl}/operations`);
  textLines.push(`Manage notifications: ${appUrl}/notifications`);

  return { subject, html, text: textLines.join("\n") };
}
