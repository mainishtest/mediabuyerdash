import type { ExecutiveKpiCard } from "../../../../lib/executiveReporting/types";

// ── Mini sparkline (inline SVG, no recharts dependency) ───────────────────────

function Sparkline({ values, variant }: { values: number[]; variant: ExecutiveKpiCard["variant"] }) {
  if (values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 56;
  const h = 24;
  const step = w / (values.length - 1);

  const points = values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const stroke =
    variant === "success" ? "#34d399" :
    variant === "warning" ? "#fbbf24" :
    variant === "danger"  ? "#fb7185" :
    "#64748b";

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
      className="shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Delta badge ───────────────────────────────────────────────────────────────

function DeltaBadge({ card }: { card: ExecutiveKpiCard }) {
  if (!card.deltaLabel || !card.deltaDirection || card.deltaDirection === "flat") {
    return <span className="text-xs text-slate-600">vs prior</span>;
  }

  const isPositive =
    card.deltaPositive === null ? null :
    card.deltaDirection === "up" ? card.deltaPositive : !card.deltaPositive;

  const cls =
    isPositive === true  ? "text-emerald-400" :
    isPositive === false ? "text-rose-400"    :
    "text-slate-400";

  const arrow = card.deltaDirection === "up" ? "↑" : "↓";

  return (
    <span className={`text-xs font-medium ${cls}`}>
      {arrow} {card.deltaLabel}
    </span>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ card }: { card: ExecutiveKpiCard }) {
  const valueClass =
    card.variant === "success" ? "text-emerald-300" :
    card.variant === "warning" ? "text-amber-300"   :
    card.variant === "danger"  ? "text-rose-300"    :
    "text-white";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{card.label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className={`text-xl font-semibold leading-none tracking-tight ${valueClass}`}>
          {card.value}
        </p>
        {card.sparkline.length >= 2 && (
          <Sparkline values={card.sparkline} variant={card.variant} />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <DeltaBadge card={card} />
      </div>
      <p className="mt-1 text-xs text-slate-600">{card.description}</p>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

export function KpiSection({ cards }: { cards: ExecutiveKpiCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map((card) => (
        <KpiCard key={card.id} card={card} />
      ))}
    </div>
  );
}
