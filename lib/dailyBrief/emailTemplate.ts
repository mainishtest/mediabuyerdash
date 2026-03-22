// ─── Daily Morning Brief — Email Template ────────────────────────────────────
//
// Pure template builder — no DB access, no side effects.
// Inline styles for email client compatibility (Gmail, Outlook, Apple Mail).
// Matches existing notification template style from lib/notifications/templates.ts.

import type { DailyMorningBrief } from "../../types/dailyBrief";

// ── Shared styles (consistent with existing notification templates) ──────────

const BODY_STYLE = `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f172a; color: #cbd5e1; margin: 0; padding: 0;`;
const CARD_STYLE = `background: #1e293b; border-radius: 12px; padding: 24px;
  max-width: 600px; margin: 32px auto;`;
const H1_STYLE = `color: #f8fafc; font-size: 20px; font-weight: 600;
  margin: 0 0 8px 0; padding: 0;`;
const H2_STYLE = `color: #e2e8f0; font-size: 15px; font-weight: 600;
  margin: 24px 0 10px 0; padding: 0;`;
const MUTED_STYLE = `color: #64748b; font-size: 13px; margin: 0 0 16px 0;`;
const LABEL_STYLE = `color: #94a3b8; font-size: 11px; text-transform: uppercase;
  letter-spacing: 0.08em; font-weight: 500; margin: 0 0 2px 0;`;
const VALUE_STYLE = `color: #e2e8f0; font-size: 16px; font-weight: 600; margin: 0;`;
const HR_STYLE = `border: none; border-top: 1px solid #334155; margin: 20px 0;`;
const FOOTER_STYLE = `color: #475569; font-size: 12px; text-align: center;
  margin-top: 20px;`;
const BTN_STYLE = `display: inline-block; background: #059669; color: #ffffff;
  text-decoration: none; padding: 10px 20px; border-radius: 8px;
  font-size: 14px; font-weight: 500; margin-top: 16px;`;
const BTN_GHOST_STYLE = `display: inline-block; background: transparent;
  color: #94a3b8; text-decoration: none; padding: 8px 16px;
  border-radius: 8px; font-size: 13px; border: 1px solid #334155;
  margin-top: 8px; margin-right: 8px;`;

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(val: number, decimals = 0): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function fmtRoas(val: number | null): string {
  return val != null ? `${val.toFixed(2)}x` : "N/A";
}

function fmtPct(val: number | null): string {
  if (val == null) return "N/A";
  const sign = val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(1)}%`;
}

function priorityColor(priority: string): string {
  switch (priority) {
    case "critical": return "#f43f5e";
    case "high":     return "#f59e0b";
    case "medium":   return "#3b82f6";
    default:         return "#64748b";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "scaling":  return "#34d399";
    case "stable":   return "#94a3b8";
    case "at_risk":  return "#f59e0b";
    case "critical": return "#f43f5e";
    default:         return "#64748b";
  }
}

function readinessDot(readiness: string): string {
  const color = readiness === "ready" ? "#34d399"
    : readiness === "blocked" ? "#f43f5e"
    : "#f59e0b";
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px;"></span>`;
}

// ── Main template builder ───────────────────────────────────────────────────

export function buildDailyBriefEmailTemplate(
  brief:    DailyMorningBrief,
  userName: string | null,
): { subject: string; html: string; text: string } {
  const date = new Date(brief.generatedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const greeting = userName ? `Hi ${userName},` : "Hi there,";
  const appUrl = process.env.NEXTAUTH_URL ?? "https://your-dashboard.vercel.app";
  const { summary } = brief;

  const subject = `Daily Brief — ${date} — ${summary.topLineMessage}`;

  // ── KPI row ──────────────────────────────────────────────────────────
  const kpiRow = `
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr>
        <td style="padding:8px 0;text-align:center;width:25%;">
          <div style="${LABEL_STYLE}">Spend</div>
          <div style="${VALUE_STYLE}">${fmtCurrency(summary.totalSpend)}</div>
        </td>
        <td style="padding:8px 0;text-align:center;width:25%;">
          <div style="${LABEL_STYLE}">Revenue</div>
          <div style="${VALUE_STYLE}">${fmtCurrency(summary.totalRevenue)}</div>
        </td>
        <td style="padding:8px 0;text-align:center;width:25%;">
          <div style="${LABEL_STYLE}">ROAS</div>
          <div style="${VALUE_STYLE}">${fmtRoas(summary.blendedRoas)}</div>
        </td>
        <td style="padding:8px 0;text-align:center;width:25%;">
          <div style="${LABEL_STYLE}">Actions</div>
          <div style="${VALUE_STYLE}">${summary.actionCount}</div>
        </td>
      </tr>
    </table>`;

  // ── Status counts row ────────────────────────────────────────────────
  const statusRow = `
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      ${summary.accountsAtRisk > 0 ? `<span style="background:#f43f5e22;color:#f43f5e;font-size:12px;padding:4px 10px;border-radius:999px;font-weight:500;">${summary.accountsAtRisk} at risk</span>` : ""}
      ${summary.accountsScaling > 0 ? `<span style="background:#34d39922;color:#34d399;font-size:12px;padding:4px 10px;border-radius:999px;font-weight:500;">${summary.accountsScaling} scaling</span>` : ""}
      ${summary.winnersCount > 0 ? `<span style="background:#3b82f622;color:#3b82f6;font-size:12px;padding:4px 10px;border-radius:999px;font-weight:500;">${summary.winnersCount} winners</span>` : ""}
      ${summary.losersCount > 0 ? `<span style="background:#f59e0b22;color:#f59e0b;font-size:12px;padding:4px 10px;border-radius:999px;font-weight:500;">${summary.losersCount} need refresh</span>` : ""}
      ${summary.blockedCount > 0 ? `<span style="background:#f43f5e22;color:#f43f5e;font-size:12px;padding:4px 10px;border-radius:999px;font-weight:500;">${summary.blockedCount} blocked</span>` : ""}
    </div>`;

  // ── Top actions section ──────────────────────────────────────────────
  const topActions = brief.actions.slice(0, 5);
  const actionsHtml = topActions.length > 0
    ? `<h2 style="${H2_STYLE}">Top Actions</h2>
       <table style="width:100%;border-collapse:collapse;">
         ${topActions.map((a) => `
           <tr>
             <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
               ${readinessDot(a.readiness)}
               <span style="color:${priorityColor(a.priority)};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-right:6px;">${a.priority}</span>
               <span style="color:#e2e8f0;font-size:14px;font-weight:500;">${a.label}</span>
               <div style="color:#64748b;font-size:12px;margin-top:2px;padding-left:14px;">${a.description}</div>
               ${a.blockerNote ? `<div style="color:#f43f5e;font-size:11px;margin-top:2px;padding-left:14px;">${a.blockerNote}</div>` : ""}
             </td>
             <td style="padding:8px 0;border-bottom:1px solid #1e293b;text-align:right;white-space:nowrap;">
               <span style="color:#94a3b8;font-size:12px;">${a.clientName}</span>
             </td>
           </tr>
         `).join("")}
       </table>`
    : "";

  // ── Winners section ──────────────────────────────────────────────────
  const winnersHtml = brief.winners.length > 0
    ? `<h2 style="${H2_STYLE}">Winners</h2>
       <table style="width:100%;border-collapse:collapse;">
         ${brief.winners.slice(0, 5).map((w) => `
           <tr>
             <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
               <div style="color:#34d399;font-size:14px;font-weight:500;">${w.title}</div>
               <div style="color:#64748b;font-size:12px;margin-top:2px;">${w.subtitle}</div>
             </td>
             <td style="padding:8px 0;border-bottom:1px solid #1e293b;text-align:right;white-space:nowrap;">
               ${w.scaleReady ? `<span style="background:#34d39922;color:#34d399;font-size:11px;padding:2px 8px;border-radius:999px;">Scale Ready</span>` : ""}
             </td>
           </tr>
         `).join("")}
       </table>`
    : "";

  // ── Losers section ───────────────────────────────────────────────────
  const losersHtml = brief.losers.length > 0
    ? `<h2 style="${H2_STYLE}">Need Refresh</h2>
       <table style="width:100%;border-collapse:collapse;">
         ${brief.losers.slice(0, 5).map((l) => `
           <tr>
             <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
               <div style="color:#f59e0b;font-size:14px;font-weight:500;">${l.title}</div>
               <div style="color:#64748b;font-size:12px;margin-top:2px;">${l.subtitle}</div>
             </td>
             <td style="padding:8px 0;border-bottom:1px solid #1e293b;text-align:right;white-space:nowrap;">
               ${l.refreshQueued ? `<span style="background:#818cf822;color:#818cf8;font-size:11px;padding:2px 8px;border-radius:999px;">Queued</span>` : ""}
             </td>
           </tr>
         `).join("")}
       </table>`
    : "";

  // ── Blocked items section ────────────────────────────────────────────
  const blockedHtml = brief.blockedItems.length > 0
    ? `<h2 style="${H2_STYLE}">Blocked</h2>
       <table style="width:100%;border-collapse:collapse;">
         ${brief.blockedItems.slice(0, 3).map((b) => `
           <tr>
             <td style="padding:8px 0;border-bottom:1px solid #1e293b;">
               <div style="color:#f43f5e;font-size:14px;font-weight:500;">${b.label}</div>
               <div style="color:#64748b;font-size:12px;margin-top:2px;">${b.reason}</div>
             </td>
             <td style="padding:8px 0;border-bottom:1px solid #1e293b;text-align:right;white-space:nowrap;">
               <span style="color:#94a3b8;font-size:12px;">${b.clientName}</span>
             </td>
           </tr>
         `).join("")}
       </table>`
    : "";

  // ── Trust warning ────────────────────────────────────────────────────
  const trustHtml = brief.trustState !== "healthy" && brief.trustState !== "unverified"
    ? `<div style="background:#f59e0b11;border:1px solid #f59e0b33;border-radius:8px;padding:12px;margin-top:16px;">
         <div style="color:#f59e0b;font-size:12px;font-weight:600;margin-bottom:4px;">DATA QUALITY WARNING</div>
         <div style="color:#94a3b8;font-size:13px;">${brief.trustMessage}</div>
       </div>`
    : "";

  // ── No data state ────────────────────────────────────────────────────
  const noDataHtml = brief.noDataYesterday
    ? `<div style="text-align:center;padding:24px 0;">
         <div style="color:#64748b;font-size:14px;">No data from yesterday.</div>
         <div style="color:#475569;font-size:13px;margin-top:4px;">Check sync status to ensure data is flowing.</div>
       </div>`
    : "";

  // ── Assemble ─────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${BODY_STYLE}">
  <div style="${CARD_STYLE}">
    <div style="display:inline-block;background:#059669;color:#ffffff;
      font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;
      padding:4px 10px;border-radius:999px;margin-bottom:16px;">
      MORNING BRIEF
    </div>
    <h1 style="${H1_STYLE}">Daily Brief</h1>
    <p style="${MUTED_STYLE}">${greeting} Here's your morning summary for ${date}.</p>

    <div style="background:#0f172a;border-radius:8px;padding:12px;margin-bottom:16px;">
      <p style="color:#f8fafc;font-size:14px;font-weight:500;margin:0;">
        ${summary.topLineMessage}
      </p>
    </div>

    ${noDataHtml || kpiRow}
    ${statusRow}
    <hr style="${HR_STYLE}">
    ${actionsHtml}
    ${winnersHtml}
    ${losersHtml}
    ${blockedHtml}
    ${trustHtml}

    <hr style="${HR_STYLE}">
    <a href="${appUrl}/briefs" style="${BTN_STYLE}">Open Full Brief</a>
    <br>
    <a href="${appUrl}/command-center" style="${BTN_GHOST_STYLE}">Command Center</a>
    <a href="${appUrl}" style="${BTN_GHOST_STYLE}">Dashboard</a>

    <p style="${FOOTER_STYLE}">
      Media Buying Dashboard · Morning Brief<br>
      All recommendations are based on CRM/Shopify data. No actions are executed automatically.<br>
      <a href="${appUrl}/notifications" style="color:#475569;">Manage notification preferences</a>
    </p>
  </div>
</body>
</html>`;

  // ── Plain text version ───────────────────────────────────────────────
  const textLines: string[] = [
    `Daily Brief — ${date}`,
    "=".repeat(50),
    "",
    greeting,
    summary.topLineMessage,
    "",
  ];

  if (!brief.noDataYesterday) {
    textLines.push(
      `Spend: ${fmtCurrency(summary.totalSpend)}  |  Revenue: ${fmtCurrency(summary.totalRevenue)}  |  ROAS: ${fmtRoas(summary.blendedRoas)}  |  Actions: ${summary.actionCount}`,
      "",
    );
  }

  if (topActions.length > 0) {
    textLines.push("── Top Actions ──");
    for (const a of topActions) {
      textLines.push(`  [${a.priority.toUpperCase()}] ${a.label}: ${a.description}${a.blockerNote ? ` (BLOCKED: ${a.blockerNote})` : ""}`);
    }
    textLines.push("");
  }

  if (brief.winners.length > 0) {
    textLines.push("── Winners ──");
    for (const w of brief.winners.slice(0, 5)) {
      textLines.push(`  ${w.title} — ${w.subtitle}${w.scaleReady ? " [Scale Ready]" : ""}`);
    }
    textLines.push("");
  }

  if (brief.losers.length > 0) {
    textLines.push("── Need Refresh ──");
    for (const l of brief.losers.slice(0, 5)) {
      textLines.push(`  ${l.title} — ${l.subtitle}`);
    }
    textLines.push("");
  }

  if (brief.blockedItems.length > 0) {
    textLines.push("── Blocked ──");
    for (const b of brief.blockedItems.slice(0, 3)) {
      textLines.push(`  ${b.label}: ${b.reason}`);
    }
    textLines.push("");
  }

  textLines.push(
    `Open full brief: ${appUrl}/briefs`,
    `Command center: ${appUrl}/command-center`,
    `Manage notifications: ${appUrl}/notifications`,
  );

  return { subject, html, text: textLines.join("\n") };
}
