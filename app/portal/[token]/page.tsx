"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type DailyRow = {
  date: string;
  spend: number;
  revenue: number;
  orders: number;
  impressions: number;
  clicks: number;
  roas: number | null;
  cpa: number | null;
};

type CampaignRow = {
  campaignId: string;
  campaignName: string;
  spend: number;
  revenue: number;
  orders: number;
  impressions: number;
  clicks: number;
  roas: number | null;
  cpa: number | null;
};

type AdRow = {
  adId: string;
  adName: string;
  campaignName: string;
  spend: number;
  revenue: number;
  orders: number;
  impressions: number;
  clicks: number;
  roas: number | null;
  cpa: number | null;
};

type Summary = {
  totalSpend: number;
  totalRevenue: number;
  totalOrders: number;
  totalImpressions: number;
  totalClicks: number;
  overallRoas: number | null;
  overallCpa: number | null;
};

type PortalData = {
  client: { name: string; brandName: string; currency: string };
  dateRange: { from: string; to: string };
  dataSource?: "utm_reconciled" | "meta_insights";
  summary: Summary;
  dailyRows: DailyRow[];
  campaignRows: CampaignRow[];
  adRows: AdRow[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(value: number, currency: string, decimals = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}

function fmtNum(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function fmtRoas(r: number | null) {
  if (r == null) return "—";
  return `${r.toFixed(2)}x`;
}

function roasColor(r: number | null) {
  if (r == null) return "text-slate-400";
  if (r >= 3) return "text-emerald-400";
  if (r >= 1.5) return "text-amber-400";
  return "text-red-400";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── Insights generator ───────────────────────────────────────────────────────

function generateInsights(data: PortalData): string[] {
  const insights: string[] = [];
  const { summary, campaignRows, adRows } = data;

  // Overall ROAS
  if (summary.overallRoas != null) {
    if (summary.overallRoas >= 3) {
      insights.push(
        `Strong overall return: every $1 spent generated $${summary.overallRoas.toFixed(2)} in revenue (${summary.overallRoas.toFixed(2)}x ROAS).`
      );
    } else if (summary.overallRoas >= 1) {
      insights.push(
        `Campaigns are returning $${summary.overallRoas.toFixed(2)} for every $1 spent. There is room to improve ROAS toward the 3x benchmark.`
      );
    } else {
      insights.push(
        `Campaigns are currently spending more than they are returning ($${summary.overallRoas.toFixed(2)} per $1 spent). Budget reallocation may be warranted.`
      );
    }
  }

  // Best performing campaign
  const sortedCampaigns = [...campaignRows].filter(c => c.roas != null).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
  if (sortedCampaigns.length > 0) {
    const best = sortedCampaigns[0];
    insights.push(
      `Top campaign: "${best.campaignName}" achieved ${fmtRoas(best.roas)} ROAS with ${fmtNum(best.orders)} attributed orders.`
    );
  }

  // Underperforming campaigns (ROAS < 1.5)
  const underperforming = campaignRows.filter(c => c.roas != null && c.roas < 1.5 && c.spend > 100);
  if (underperforming.length > 0) {
    const names = underperforming.slice(0, 2).map(c => `"${c.campaignName}"`).join(", ");
    insights.push(
      `${underperforming.length === 1 ? "Campaign" : "Campaigns"} ${names} ${underperforming.length === 1 ? "is" : "are"} below 1.5x ROAS — consider pausing or reallocating budget.`
    );
  }

  // Best ad
  const sortedAds = [...adRows].filter(a => a.roas != null && a.spend > 50).sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
  if (sortedAds.length > 0) {
    const topAd = sortedAds[0];
    insights.push(
      `Best performing ad: "${topAd.adName}" — ${fmtRoas(topAd.roas)} ROAS. Consider scaling spend on this creative.`
    );
  }

  // Click efficiency
  const ctr = summary.totalImpressions > 0
    ? (summary.totalClicks / summary.totalImpressions) * 100
    : null;
  if (ctr != null) {
    if (ctr >= 1.5) {
      insights.push(
        `Click-through rate of ${ctr.toFixed(2)}% is above the 1.5% benchmark — ads are resonating with the audience.`
      );
    } else {
      insights.push(
        `Click-through rate is ${ctr.toFixed(2)}% — below the 1.5% benchmark. Creative refresh or audience adjustment may improve engagement.`
      );
    }
  }

  return insights;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="mb-3 text-base font-semibold text-slate-200">{title}</h2>
  );
}

type SortKey = "spend" | "revenue" | "roas" | "orders" | "clicks";

function getNumericField(row: CampaignRow | AdRow, key: SortKey): number {
  if (key === "spend")   return row.spend;
  if (key === "revenue") return row.revenue;
  if (key === "orders")  return row.orders;
  if (key === "clicks")  return row.clicks;
  if (key === "roas")    return row.roas ?? -Infinity;
  return 0;
}

function CampaignTable({ rows, currency }: { rows: CampaignRow[]; currency: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const sorted = [...rows].sort((a, b) => getNumericField(b, sortKey) - getNumericField(a, sortKey));

  const cols: { key: SortKey; label: string }[] = [
    { key: "spend", label: "Spend" },
    { key: "revenue", label: "Revenue" },
    { key: "roas", label: "ROAS" },
    { key: "orders", label: "Orders" },
    { key: "clicks", label: "Clicks" },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/80">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-400">Campaign</th>
            {cols.map(c => (
              <th
                key={c.key}
                className="cursor-pointer px-4 py-3 text-right font-medium text-slate-400 hover:text-slate-200"
                onClick={() => setSortKey(c.key)}
              >
                {c.label}
                {sortKey === c.key && <span className="ml-1 text-emerald-400">↓</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sorted.map((row, i) => (
            <tr key={row.campaignId || i} className="bg-slate-900/40 hover:bg-slate-800/40">
              <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-200">
                {row.campaignName || "—"}
              </td>
              <td className="px-4 py-3 text-right text-slate-300">{fmt(row.spend, currency)}</td>
              <td className="px-4 py-3 text-right text-slate-300">{fmt(row.revenue, currency)}</td>
              <td className={`px-4 py-3 text-right font-medium ${roasColor(row.roas)}`}>{fmtRoas(row.roas)}</td>
              <td className="px-4 py-3 text-right text-slate-300">{fmtNum(row.orders)}</td>
              <td className="px-4 py-3 text-right text-slate-400">{fmtNum(row.clicks)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                No campaign data for this date range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AdTable({ rows, currency }: { rows: AdRow[]; currency: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [showAll, setShowAll] = useState(false);

  const sorted = [...rows].sort((a, b) => getNumericField(b, sortKey) - getNumericField(a, sortKey));
  const visible = showAll ? sorted : sorted.slice(0, 10);

  const cols: { key: SortKey; label: string }[] = [
    { key: "spend", label: "Spend" },
    { key: "revenue", label: "Revenue" },
    { key: "roas", label: "ROAS" },
    { key: "orders", label: "Orders" },
    { key: "clicks", label: "Clicks" },
  ];

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/80">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-400">Ad</th>
              <th className="px-4 py-3 text-left font-medium text-slate-400">Campaign</th>
              {cols.map(c => (
                <th
                  key={c.key}
                  className="cursor-pointer px-4 py-3 text-right font-medium text-slate-400 hover:text-slate-200"
                  onClick={() => setSortKey(c.key)}
                >
                  {c.label}
                  {sortKey === c.key && <span className="ml-1 text-emerald-400">↓</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visible.map((row, i) => (
              <tr key={row.adId || i} className="bg-slate-900/40 hover:bg-slate-800/40">
                <td className="max-w-xs truncate px-4 py-3 font-medium text-slate-200">
                  {row.adName || "—"}
                </td>
                <td className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-500">
                  {row.campaignName || "—"}
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{fmt(row.spend, currency)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{fmt(row.revenue, currency)}</td>
                <td className={`px-4 py-3 text-right font-medium ${roasColor(row.roas)}`}>{fmtRoas(row.roas)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{fmtNum(row.orders)}</td>
                <td className="px-4 py-3 text-right text-slate-400">{fmtNum(row.clicks)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No ad data for this date range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > 10 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
        >
          {showAll ? "Show less" : `Show all ${sorted.length} ads`}
        </button>
      )}
    </div>
  );
}

function DailyTable({ rows, currency }: { rows: DailyRow[]; currency: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/80">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-400">Date</th>
            <th className="px-4 py-3 text-right font-medium text-slate-400">Spend</th>
            <th className="px-4 py-3 text-right font-medium text-slate-400">Revenue</th>
            <th className="px-4 py-3 text-right font-medium text-slate-400">ROAS</th>
            <th className="px-4 py-3 text-right font-medium text-slate-400">Orders</th>
            <th className="px-4 py-3 text-right font-medium text-slate-400">Clicks</th>
            <th className="px-4 py-3 text-right font-medium text-slate-400">Impressions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {[...rows].reverse().map((row) => (
            <tr key={row.date} className="bg-slate-900/40 hover:bg-slate-800/40">
              <td className="px-4 py-3 text-slate-300">{row.date}</td>
              <td className="px-4 py-3 text-right text-slate-300">{fmt(row.spend, currency)}</td>
              <td className="px-4 py-3 text-right text-slate-300">{fmt(row.revenue, currency)}</td>
              <td className={`px-4 py-3 text-right font-medium ${roasColor(row.roas)}`}>{fmtRoas(row.roas)}</td>
              <td className="px-4 py-3 text-right text-slate-300">{fmtNum(row.orders)}</td>
              <td className="px-4 py-3 text-right text-slate-400">{fmtNum(row.clicks)}</td>
              <td className="px-4 py-3 text-right text-slate-400">{fmtNum(row.impressions)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                No daily data for this date range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main portal page ─────────────────────────────────────────────────────────

// ─── Password gate ────────────────────────────────────────────────────────────

function PasswordGate({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${token}/auth`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ password }),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const body = await res.json();
        setError(body.error ?? "Incorrect password");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Performance Report
        </p>
        <h1 className="mb-6 text-xl font-bold text-white">Enter your access password</h1>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3
                       text-sm text-slate-200 placeholder-slate-600 outline-none
                       focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
          />
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold
                       text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Verifying…" : "View Report"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageProps = { params: { token: string } };

const PRESETS = [
  { label: "Last 7 days",  from: () => daysAgo(7),  to: today },
  { label: "Last 14 days", from: () => daysAgo(14), to: today },
  { label: "Last 30 days", from: () => daysAgo(30), to: today },
];

export default function ClientPortalPage({ params }: PageProps) {
  const { token } = params;

  const [fromDate,       setFromDate]       = useState(daysAgo(30));
  const [toDate,         setToDate]         = useState(today());
  const [data,           setData]           = useState<PortalData | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [activeTab,      setActiveTab]      = useState<"chart" | "daily" | "campaigns" | "ads">("chart");
  const [needsPassword,  setNeedsPassword]  = useState(false);

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${token}?from=${from}&to=${to}`);
      if (res.status === 401) {
        const body = await res.json();
        if (body.requiresPassword) { setNeedsPassword(true); setLoading(false); return; }
      }
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to load data");
      }
      setNeedsPassword(false);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData(fromDate, toDate);
  }, [fetchData, fromDate, toDate]);

  if (needsPassword) {
    return <PasswordGate token={token} onSuccess={() => fetchData(fromDate, toDate)} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading your report…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="max-w-sm rounded-2xl border border-red-800/50 bg-red-900/20 p-8 text-center">
          <p className="text-lg font-semibold text-red-300">Unable to load report</p>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { client, summary, dailyRows, campaignRows, adRows } = data;
  const currency = client.currency;
  const insights = generateInsights(data);

  // Chart data: format dates more friendly
  const chartData = dailyRows.map(d => ({
    date: d.date.slice(5), // MM-DD
    Spend: parseFloat(d.spend.toFixed(2)),
    Revenue: parseFloat(d.revenue.toFixed(2)),
  }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-5">
        <div className="mx-auto max-w-6xl flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Performance Report</p>
            <h1 className="mt-0.5 text-xl font-bold text-white">{client.brandName}</h1>
          </div>
          {/* Date range controls */}
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => { setFromDate(p.from()); setToDate(p.to()); }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                  ${fromDate === p.from() && toDate === p.to()
                    ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                    : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1">
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={e => setFromDate(e.target.value)}
                className="bg-transparent text-xs text-slate-300 outline-none"
              />
              <span className="text-xs text-slate-600">→</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={today()}
                onChange={e => setToDate(e.target.value)}
                className="bg-transparent text-xs text-slate-300 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="Total Spend"
            value={fmt(summary.totalSpend, currency)}
          />
          <StatCard
            label="Total Revenue"
            value={fmt(summary.totalRevenue, currency)}
          />
          <StatCard
            label="Overall ROAS"
            value={fmtRoas(summary.overallRoas)}
            sub="Revenue / Spend"
          />
          <StatCard
            label="Total Orders"
            value={fmtNum(summary.totalOrders)}
          />
          <StatCard
            label="Total Clicks"
            value={fmtNum(summary.totalClicks)}
          />
          <StatCard
            label="Impressions"
            value={fmtNum(summary.totalImpressions)}
          />
        </div>

        {/* Tabs */}
        <div>
          <div className="mb-4 flex gap-1 border-b border-slate-800">
            {(["chart", "daily", "campaigns", "ads"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors capitalize
                  ${activeTab === tab
                    ? "border-b-2 border-emerald-500 text-emerald-400"
                    : "text-slate-500 hover:text-slate-300"
                  }`}
              >
                {tab === "chart" ? "Spend & Revenue" : tab === "daily" ? "Day by Day" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === "chart" && (
            <div>
              <SectionHeader title="Daily Spend vs Revenue" />
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                      tick={{ fill: "#64748b", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                      labelStyle={{ color: "#94a3b8" }}
                      itemStyle={{ color: "#e2e8f0" }}
                      formatter={(v) => typeof v === "number" ? [`$${v.toLocaleString()}`, ""] : [String(v), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                    <Area type="monotone" dataKey="Spend" stroke="#f59e0b" fill="url(#colorSpend)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="Revenue" stroke="#10b981" fill="url(#colorRevenue)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === "daily" && (
            <div>
              <SectionHeader title="Day-by-Day Performance" />
              <DailyTable rows={dailyRows} currency={currency} />
            </div>
          )}

          {activeTab === "campaigns" && (
            <div>
              <SectionHeader title="Campaign Performance" />
              <p className="mb-3 text-xs text-slate-500">Click any column header to sort.</p>
              <CampaignTable rows={campaignRows} currency={currency} />
            </div>
          )}

          {activeTab === "ads" && (
            <div>
              <SectionHeader title="Ad Performance" />
              <p className="mb-3 text-xs text-slate-500">Showing ads sorted by spend. Click any column header to re-sort.</p>
              <AdTable rows={adRows} currency={currency} />
            </div>
          )}
        </div>

        {/* Insights summary */}
        {insights.length > 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6">
            <h2 className="mb-4 text-base font-semibold text-slate-200">Performance Summary</h2>
            <ul className="space-y-3">
              {insights.map((insight, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-900/50 text-xs font-bold text-emerald-400">
                    {i + 1}
                  </span>
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-800 pt-6 text-center">
          <p className="text-xs text-slate-600">
            {data.dataSource === "meta_insights"
              ? "Data reflects Meta ad spend and delivery metrics. Revenue figures will appear once Shopify reconciliation is complete."
              : "Data reflects Meta ad spend reconciled against Shopify attributed revenue. Revenue figures use a 7-day attribution window."
            }
          </p>
          <p className="mt-1 text-xs text-slate-700">
            Report generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
