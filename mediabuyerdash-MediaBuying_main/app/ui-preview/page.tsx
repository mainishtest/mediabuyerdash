import { PageHeader }   from "../../components/ui/PageHeader";
import { StatCard }     from "../../components/ui/StatCard";
import { SectionCard }  from "../../components/ui/SectionCard";
import { Badge }        from "../../components/ui/Badge";
import { ActionButton } from "../../components/ui/ActionButton";
import { EmptyState }   from "../../components/ui/EmptyState";
import { DataTable }    from "../../components/ui/DataTable";
import { FilterBar, FilterLabel } from "../../components/ui/FilterBar";
import type { TableColumn } from "../../components/ui/DataTable";

// ─── Sample data for table demo ──────────────────────────────────────────────
interface DemoRow {
  id:       string;
  campaign: string;
  spend:    string;
  roas:     string;
  status:   string;
}

const TABLE_ROWS: DemoRow[] = [
  { id: "1", campaign: "Summer Sale — Broad",  spend: "$4,820",  roas: "3.2x", status: "active"  },
  { id: "2", campaign: "Retargeting — 7d",     spend: "$1,240",  roas: "5.8x", status: "active"  },
  { id: "3", campaign: "Lookalike — 2%",       spend: "$890",    roas: "1.4x", status: "paused"  },
  { id: "4", campaign: "Brand Awareness",      spend: "$3,100",  roas: "0.9x", status: "review"  },
];

const TABLE_COLS: TableColumn<DemoRow>[] = [
  {
    key: "campaign", header: "Campaign",
    render: (r) => <span className="font-medium text-white">{r.campaign}</span>,
  },
  {
    key: "spend", header: "Spend", align: "right",
    render: (r) => r.spend,
  },
  {
    key: "roas", header: "ROAS", align: "right",
    render: (r) => r.roas,
  },
  {
    key: "status", header: "Status",
    render: (r) => (
      <Badge
        variant={
          r.status === "active"  ? "success" :
          r.status === "paused"  ? "neutral" : "warning"
        }
      >
        {r.status}
      </Badge>
    ),
  },
];

export default function UIPreviewPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-6 py-8">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="UI Preview"
        description="Design system reference — all reusable components in one place."
        badge={<Badge variant="info">Design System</Badge>}
      />

      {/* ── Typography ──────────────────────────────────────────────────── */}
      <SectionCard title="Typography" description="Text hierarchy across the app.">
        <div className="space-y-3">
          <p className="text-2xl font-semibold tracking-tight text-white">
            Page Title — 2xl semibold
          </p>
          <p className="text-xl font-semibold text-white">
            Section Heading — xl semibold
          </p>
          <p className="text-base font-medium text-slate-200">
            Card Title — base medium
          </p>
          <p className="text-sm text-slate-300">
            Body copy — sm, slate-300. Used for most paragraphs and descriptions
            inside cards and data sections.
          </p>
          <p className="text-xs text-slate-500">
            Muted / meta — xs, slate-500. Used for timestamps, IDs, and
            secondary context.
          </p>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Section Label — xs uppercase widest
          </p>
        </div>
      </SectionCard>

      {/* ── Badges ──────────────────────────────────────────────────────── */}
      <SectionCard title="Badges" description="Status indicators and labels.">
        <div className="flex flex-wrap gap-3">
          <Badge variant="success">Active</Badge>
          <Badge variant="warning">Needs Review</Badge>
          <Badge variant="danger">Critical</Badge>
          <Badge variant="info">Syncing</Badge>
          <Badge variant="neutral">Draft</Badge>
          <Badge variant="purple">AI Generated</Badge>
        </div>
      </SectionCard>

      {/* ── Buttons ─────────────────────────────────────────────────────── */}
      <SectionCard title="Buttons" description="Action button variants and sizes.">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Variants
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionButton variant="primary">Primary Action</ActionButton>
              <ActionButton variant="secondary">Secondary</ActionButton>
              <ActionButton variant="ghost">Ghost</ActionButton>
              <ActionButton variant="danger">Danger</ActionButton>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Sizes
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton size="sm">Small</ActionButton>
              <ActionButton size="md">Medium</ActionButton>
              <ActionButton size="lg">Large</ActionButton>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Disabled state
            </p>
            <div className="flex flex-wrap gap-3">
              <ActionButton variant="primary" disabled>
                Disabled Primary
              </ActionButton>
              <ActionButton variant="secondary" disabled>
                Disabled Secondary
              </ActionButton>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Stat Cards ──────────────────────────────────────────────────── */}
      <SectionCard title="Stat Cards" description="Key metric display cards.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Spend"
            value="$48,200"
            sub="Last 30 days"
            trend={{ direction: "up", label: "+12% vs prior period" }}
          />
          <StatCard
            label="Avg ROAS"
            value="3.4x"
            sub="CRM-sourced revenue"
            trend={{ direction: "up", label: "Goal: 3.0x" }}
          />
          <StatCard
            label="Avg CPA"
            value="$58.40"
            sub="7-day attribution"
            trend={{ direction: "down", label: "Goal: $60 — on track" }}
          />
          <StatCard
            label="Conversions"
            value="824"
            sub="Verified via CRM"
          />
        </div>
      </SectionCard>

      {/* ── Section Cards ───────────────────────────────────────────────── */}
      <SectionCard
        title="Section Card"
        description="A bordered content card with optional title, description, and actions."
        actions={<ActionButton size="sm">Add New</ActionButton>}
      >
        <p className="text-sm text-slate-400">
          This is the inner content area. Any component can be placed here —
          tables, grids, forms, or plain text.
        </p>
      </SectionCard>

      <SectionCard>
        <p className="text-sm text-slate-400">
          Section card without a title — just a clean bordered surface.
        </p>
      </SectionCard>

      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <SectionCard title="Filter Bar" description="Horizontal filter controls.">
        <FilterBar>
          <FilterLabel>Account</FilterLabel>
          <select className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200">
            <option>All Accounts</option>
            <option>Client A</option>
            <option>Client B</option>
          </select>
          <FilterLabel>Status</FilterLabel>
          <select className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200">
            <option>All</option>
            <option>Active</option>
            <option>Paused</option>
          </select>
          <ActionButton size="sm" variant="ghost">
            Reset
          </ActionButton>
        </FilterBar>
      </SectionCard>

      {/* ── Data Table ──────────────────────────────────────────────────── */}
      <SectionCard
        title="Data Table"
        description="Reusable generic table with hover states and empty state."
        flush
      >
        <div className="p-5">
          <DataTable
            columns={TABLE_COLS}
            rows={TABLE_ROWS}
            getKey={(r) => r.id}
          />
        </div>
      </SectionCard>

      {/* ── Empty State ─────────────────────────────────────────────────── */}
      <SectionCard title="Empty State" description="Shown when a list has no items.">
        <EmptyState
          title="No campaigns found"
          description="When campaigns are synced from Meta or added manually, they will appear here."
          action={<ActionButton variant="primary">Sync Now</ActionButton>}
          icon="◌"
        />
      </SectionCard>

      {/* ── Color Palette ───────────────────────────────────────────────── */}
      <SectionCard
        title="Color Palette"
        description="Core surface and accent colors used throughout the app."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { name: "slate-950",   cls: "bg-slate-950 border border-slate-800" },
            { name: "slate-900",   cls: "bg-slate-900 border border-slate-700" },
            { name: "slate-800",   cls: "bg-slate-800" },
            { name: "slate-700",   cls: "bg-slate-700" },
            { name: "emerald-600", cls: "bg-emerald-600" },
            { name: "emerald-400", cls: "bg-emerald-400" },
            { name: "rose-600",    cls: "bg-rose-600" },
            { name: "amber-500",   cls: "bg-amber-500" },
            { name: "sky-500",     cls: "bg-sky-500" },
            { name: "violet-600",  cls: "bg-violet-600" },
          ].map((swatch) => (
            <div key={swatch.name} className="flex flex-col gap-1.5">
              <div className={`h-10 rounded-lg ${swatch.cls}`} />
              <p className="text-xs text-slate-500">{swatch.name}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
