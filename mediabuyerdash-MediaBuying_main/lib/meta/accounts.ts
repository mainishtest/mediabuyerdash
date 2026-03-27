import { META_GRAPH_BASE } from "./config";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RawMetaAdAccount {
  id:             string; // Meta format: "act_XXXXXXXXXX"
  name:           string;
  account_status: number;
  currency:       string;
  timezone_name:  string;
}

// ── Graph API call ────────────────────────────────────────────────────────────

export async function fetchAccessibleAdAccounts(
  accessToken: string
): Promise<RawMetaAdAccount[]> {
  const fields = "id,name,account_status,currency,timezone_name";
  const url = `${META_GRAPH_BASE}/me/adaccounts?fields=${fields}&limit=100&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Failed to fetch ad accounts: ${JSON.stringify(body)}`);
  }

  const data = await res.json();
  return (data.data as RawMetaAdAccount[]) ?? [];
}

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<number, string> = {
  1:   "Active",
  2:   "Disabled",
  3:   "Unsettled",
  7:   "Pending Risk Review",
  8:   "Pending Settlement",
  9:   "In Grace Period",
  100: "Pending Closure",
  101: "Closed",
};

export function getAdAccountStatusLabel(status: number): string {
  return STATUS_LABELS[status] ?? `Status ${status}`;
}

export function getAdAccountStatusVariant(
  status: number
): "success" | "warning" | "danger" | "neutral" {
  if (status === 1)                     return "success";
  if ([2, 101].includes(status))        return "danger";
  if ([3, 7, 8, 9, 100].includes(status)) return "warning";
  return "neutral";
}
