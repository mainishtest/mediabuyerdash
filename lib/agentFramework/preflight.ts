// Agent Framework — Preflight Engine
//
// Structured validation for campaign drafts before execution.
// Each check returns pass/warn/fail with a blocking flag.

import type { PreflightCheck } from "./types";
import { DEFAULT_PLAYBOOK } from "./constants";

interface PreflightDraftInput {
  campaignName?: string;
  adSetName?: string;
  objective?: string;
  dailyBudget?: number;
  adAccount?: { id: string; externalId: string } | null;
  page?: { id: string } | null;
  pixel?: { id: string } | null;
  conversionEvent?: string | null;
  ads?: Array<{ destinationUrl?: string; primaryText?: string; creative?: { url?: string | null } }>;
  targeting?: { targeting?: { locations?: string[] } };
}

export function runPreflightChecks(draft: PreflightDraftInput): PreflightCheck[] {
  const checks: PreflightCheck[] = [];

  // ── Ad Account ──────────────────────────────────────────────────────────
  checks.push(
    draft.adAccount
      ? { name: "Ad Account", status: "pass", message: `Connected: ${draft.adAccount.externalId}`, blocking: false }
      : { name: "Ad Account", status: "fail", message: "No Meta ad account connected. Connect one before launching.", blocking: true }
  );

  // ── Facebook Page ───────────────────────────────────────────────────────
  checks.push(
    draft.page?.id
      ? { name: "Facebook Page", status: "pass", message: "Page connected", blocking: false }
      : { name: "Facebook Page", status: "warn", message: "No Facebook Page selected. Required for ad delivery.", blocking: false }
  );

  // ── Pixel (required for Sales/Leads) ────────────────────────────────────
  const needsPixel = draft.objective === "OUTCOME_SALES" || draft.objective === "OUTCOME_LEADS";
  if (needsPixel) {
    checks.push(
      draft.pixel?.id
        ? { name: "Meta Pixel", status: "pass", message: "Pixel configured for conversion tracking", blocking: false }
        : { name: "Meta Pixel", status: "fail", message: "Sales/Leads objective requires a pixel for conversion tracking.", blocking: true }
    );
  } else {
    checks.push(
      { name: "Meta Pixel", status: "pass", message: "Not required for this objective", blocking: false }
    );
  }

  // ── Budget ──────────────────────────────────────────────────────────────
  const budget = draft.dailyBudget ?? 0;
  const minBudget = 1;
  const capBudget = DEFAULT_PLAYBOOK.budgetCaps.daily;

  if (budget < minBudget) {
    checks.push({ name: "Daily Budget", status: "fail", message: `Budget $${budget}/day is below Meta minimum ($${minBudget}/day).`, blocking: true });
  } else if (budget > capBudget) {
    checks.push({ name: "Daily Budget", status: "warn", message: `Budget $${budget}/day exceeds playbook cap ($${capBudget}/day). Confirm this is intentional.`, blocking: false });
  } else {
    checks.push({ name: "Daily Budget", status: "pass", message: `$${budget}/day within acceptable range`, blocking: false });
  }

  // ── Creatives ───────────────────────────────────────────────────────────
  const adCount = draft.ads?.length ?? 0;
  if (adCount === 0) {
    checks.push({ name: "Creative Assets", status: "fail", message: "No creatives attached. Add at least one ad creative.", blocking: true });
  } else {
    const missingMedia = draft.ads?.filter((a) => !a.creative?.url).length ?? 0;
    if (missingMedia > 0) {
      checks.push({ name: "Creative Assets", status: "warn", message: `${missingMedia} of ${adCount} ads missing media URL. Upload media before launching.`, blocking: false });
    } else {
      checks.push({ name: "Creative Assets", status: "pass", message: `${adCount} creative(s) attached`, blocking: false });
    }
  }

  // ── Destination URL ─────────────────────────────────────────────────────
  const hasUrl = draft.ads?.some((a) => a.destinationUrl && a.destinationUrl.length > 0);
  if (!hasUrl && adCount > 0) {
    checks.push({ name: "Destination URL", status: "warn", message: "No destination URL set on ads. Required for traffic/conversion campaigns.", blocking: false });
  } else if (hasUrl) {
    checks.push({ name: "Destination URL", status: "pass", message: "Destination URL configured", blocking: false });
  }

  // ── Ad Copy ─────────────────────────────────────────────────────────────
  const hasCopy = draft.ads?.some((a) => a.primaryText && a.primaryText.length > 0);
  if (!hasCopy && adCount > 0) {
    checks.push({ name: "Ad Copy", status: "warn", message: "No primary text set. Ads perform better with compelling copy.", blocking: false });
  } else if (hasCopy) {
    checks.push({ name: "Ad Copy", status: "pass", message: "Ad copy configured", blocking: false });
  }

  // ── Naming Convention ───────────────────────────────────────────────────
  const hasProperName = draft.campaignName && draft.campaignName.includes("—");
  checks.push(
    hasProperName
      ? { name: "Naming Convention", status: "pass", message: "Campaign name follows playbook convention", blocking: false }
      : { name: "Naming Convention", status: "warn", message: "Campaign name doesn't follow playbook convention (Brand — Type — Date).", blocking: false }
  );

  // ── Targeting ───────────────────────────────────────────────────────────
  const locations = draft.targeting?.targeting?.locations ?? [];
  if (locations.length === 0) {
    checks.push({ name: "Targeting", status: "warn", message: "No targeting locations set. Defaulting to US.", blocking: false });
  } else {
    checks.push({ name: "Targeting", status: "pass", message: `Targeting: ${locations.join(", ")}`, blocking: false });
  }

  return checks;
}

// ── Summary helpers ─────────────────────────────────────────────────────────

export function hasBlockingChecks(checks: PreflightCheck[]): boolean {
  return checks.some((c) => c.status === "fail" && c.blocking);
}

export function preflightSummary(checks: PreflightCheck[]): {
  passed: number;
  warnings: number;
  failed: number;
  blocking: boolean;
} {
  return {
    passed: checks.filter((c) => c.status === "pass").length,
    warnings: checks.filter((c) => c.status === "warn").length,
    failed: checks.filter((c) => c.status === "fail").length,
    blocking: hasBlockingChecks(checks),
  };
}
