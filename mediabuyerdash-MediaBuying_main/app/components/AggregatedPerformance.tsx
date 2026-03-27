import type {
  AccountSummary,
  CampaignSummary,
  DateSummary
} from "../../lib/aggregations";
import { MetricStat } from "./MetricStat";
import { formatCurrency, formatRoas } from "../../lib/metricUtils";

type AggregatedPerformanceProps = {
  accountSummaries: AccountSummary[];
  campaignSummaries: CampaignSummary[];
  dateSummaries: DateSummary[];
};

const TH = "px-4 py-3 text-left text-xs font-medium uppercase tracking-widest text-slate-400";
const TD = "px-4 py-3 text-sm text-slate-300";

export function AggregatedPerformance({
  accountSummaries,
  campaignSummaries,
  dateSummaries
}: AggregatedPerformanceProps) {
  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold text-slate-50">
        Aggregated Performance Preview
      </h2>
      <p className="mb-6 text-sm text-slate-400">
        Hourly sample metrics rolled up by account, campaign, and date.
        This aggregation layer will power future dashboard views, dayparting
        analysis, and optimization features.
      </p>

      {/* Account-level summary */}
      <div className="mb-8">
        <h3 className="mb-3 text-base font-medium text-slate-200">
          Account-Level Summary
        </h3>
        {accountSummaries.map((a) => (
          <div key={a.accountId}>
            <p className="mb-3 text-xs text-slate-500">
              Account: <span className="text-slate-400">{a.accountId}</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricStat label="Total Spend"       value={formatCurrency(a.spend)} />
              <MetricStat label="Total Impressions" value={a.impressions.toLocaleString()} />
              <MetricStat label="Total Clicks"      value={a.clicks.toLocaleString()} />
              <MetricStat label="Total Conversions" value={String(a.conversions)} />
              <MetricStat label="Total Revenue"     value={formatCurrency(a.revenue)} />
              <MetricStat label="Avg CPA"           value={formatCurrency(a.cpa)} />
              <MetricStat label="Avg ROAS"          value={formatRoas(a.roas)} />
            </div>
          </div>
        ))}
      </div>

      {/* Campaign-level summary */}
      <div className="mb-8">
        <h3 className="mb-3 text-base font-medium text-slate-200">
          Campaign-Level Summary
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className={TH}>Campaign</th>
                <th className={TH}>Spend</th>
                <th className={TH}>Impressions</th>
                <th className={TH}>Conversions</th>
                <th className={TH}>CPA</th>
                <th className={TH}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {campaignSummaries.map((c, i) => (
                <tr
                  key={c.campaignId}
                  className={i < campaignSummaries.length - 1 ? "border-b border-slate-800" : ""}
                >
                  <td className={`${TD} font-medium text-slate-200`}>{c.campaignId}</td>
                  <td className={TD}>{formatCurrency(c.spend)}</td>
                  <td className={TD}>{c.impressions.toLocaleString()}</td>
                  <td className={TD}>{c.conversions}</td>
                  <td className={TD}>{formatCurrency(c.cpa)}</td>
                  <td className={TD}>{formatRoas(c.roas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Date-level summary */}
      <div>
        <h3 className="mb-3 text-base font-medium text-slate-200">
          Date-Level Summary Preview
        </h3>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm shadow-slate-900/40">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className={TH}>Date</th>
                <th className={TH}>Spend</th>
                <th className={TH}>Impressions</th>
                <th className={TH}>Conversions</th>
                <th className={TH}>CPA</th>
                <th className={TH}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {dateSummaries.map((d, i) => (
                <tr
                  key={d.date}
                  className={i < dateSummaries.length - 1 ? "border-b border-slate-800" : ""}
                >
                  <td className={`${TD} font-medium text-slate-200`}>{d.date}</td>
                  <td className={TD}>{formatCurrency(d.spend)}</td>
                  <td className={TD}>{d.impressions.toLocaleString()}</td>
                  <td className={TD}>{d.conversions}</td>
                  <td className={TD}>{formatCurrency(d.cpa)}</td>
                  <td className={TD}>{formatRoas(d.roas)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
