// ─── Executive Reporting — Typed Models ──────────────────────────────────────
//
// All types for the executive reporting and client summary layer.
// No business logic lives here — pure type definitions only.

// ── Filters ───────────────────────────────────────────────────────────────────

export type ExecutiveFilterState = {
  clientId?: string;
  campaignId?: string;
  dateFrom: string;
  dateTo: string;
  compareWithPrevious: boolean;
};

// ── KPI cards ─────────────────────────────────────────────────────────────────

export type KpiVariant = "success" | "warning" | "danger" | "neutral";

export type ExecutiveKpiCard = {
  id:               string;
  label:            string;
  value:            string;       // formatted display value
  rawValue:         number | null;
  delta:            number | null; // absolute or pct delta vs comparison
  deltaLabel:       string | null; // e.g. "+12%" or "−$4.2k"
  deltaDirection:   "up" | "down" | "flat" | null;
  deltaPositive:    boolean | null; // true = higher is better (ROAS), false = higher is bad (CPA)
  sparkline:        number[];      // raw daily values for mini chart
  variant:          KpiVariant;
  description:      string;
};

// ── Trend ─────────────────────────────────────────────────────────────────────

export type ExecutiveTrendPoint = {
  date:    string;
  spend:   number;
  revenue: number;
  roas:    number | null;
};

export type ExecutiveTrendSummary = {
  dateFrom:     string;
  dateTo:       string;
  byDay:        ExecutiveTrendPoint[];
  totalSpend:   number;
  totalRevenue: number;
  overallRoas:  number | null;
  overallCpa:   number | null;
  totalOrders:  number;
  hasSpendData: boolean;
};

// ── Experiments ───────────────────────────────────────────────────────────────

export type ExecutiveExperimentItem = {
  id:                string;
  name:              string;
  status:            string;
  outcome:           string | null;
  winningVariant:    string | null;
  recommendedAction: string | null;
  primaryMetricLift: number | null;
  daysRunning:       number;
  hasResult:         boolean;
};

export type ExecutiveExperimentSummary = {
  totalRun:             number;
  activeCount:          number;
  completedThisPeriod:  number;
  winnersCount:         number;
  noWinnerCount:        number;
  insufficientDataCount: number;
  items:                ExecutiveExperimentItem[];
};

// ── Creative ──────────────────────────────────────────────────────────────────

export type ExecutiveCreativeItem = {
  id:           string;
  title:        string;
  variantType:  string;
  briefIntent:  string;
  clientName:   string;
  campaignName: string | null;
  status:       string;
  isLaunched:   boolean;
  publishedAt:  string | null;
};

export type ExecutiveCreativeSummary = {
  briefsCreated:      number;
  variantsGenerated:  number;
  variantsApproved:   number;
  variantsLaunched:   number;
  items:              ExecutiveCreativeItem[];
};

// ── Impact ────────────────────────────────────────────────────────────────────

export type ExecutiveAlertItem = {
  id:          string;
  alertType:   string;
  severity:    string;
  entityName:  string;
  clientName:  string;
  summary:     string;
  detectedAt:  string;
};

export type ExecutiveImpactSummary = {
  pacingRisksCount:          number;
  unresolvedAlertsCount:     number;
  notableAlerts:             ExecutiveAlertItem[];
  autoExecutionsThisPeriod:  number;
  autoExecutionSuccessCount: number;
  guardrailBlocksCount:      number;
  dataWarnings:              string[];
};

// ── Approvals ─────────────────────────────────────────────────────────────────

export type ExecutiveApprovalItem = {
  id:          string;
  actionType:  string;
  status:      string;
  entityName:  string;
  clientName:  string;
  rationale:   string;
  proposedAt:  string;
  resolvedAt:  string | null;
};

export type ExecutiveApprovalSummary = {
  pendingCount:         number;
  approvedThisPeriod:   number;
  rejectedThisPeriod:   number;
  executedThisPeriod:   number;
  items:                ExecutiveApprovalItem[];
};

// ── Narrative ─────────────────────────────────────────────────────────────────

export type ExecutiveNarrativeSection = {
  headline:           string;
  whatHappened:       string;
  whatChanged:        string;
  whatWorked:         string;
  whatUnderperformed: string;
  actionsTaken:       string;
  whatsNext:          string;
};

// ── Full summary payload ──────────────────────────────────────────────────────

export type ExecutiveSummary = {
  generatedAt:     string;
  dateRange:       { from: string; to: string };
  comparisonRange: { from: string; to: string } | null;
  clientId:        string | null;
  clientName:      string | null;
  kpiCards:        ExecutiveKpiCard[];
  trend:           ExecutiveTrendSummary;
  comparisonTrend: ExecutiveTrendSummary | null;
  experiments:     ExecutiveExperimentSummary;
  creative:        ExecutiveCreativeSummary;
  impact:          ExecutiveImpactSummary;
  approvals:       ExecutiveApprovalSummary;
  narrative:       ExecutiveNarrativeSection;
  hasData:         boolean;
  clients:         { id: string; name: string }[];
};
