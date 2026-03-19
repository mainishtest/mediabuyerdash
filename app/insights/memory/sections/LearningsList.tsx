import type { LearningMemoryEntry, LearningCategory } from "../../../../lib/learningMemory/types";
import { CATEGORY_LABEL, CATEGORY_ACCENT } from "../../../../lib/learningMemory/patterns";
import { LearningCard } from "./LearningCard";

// ── Flat list ─────────────────────────────────────────────────────────────────

export function FlatLearningsList({
  entries,
  emptyMessage,
}: {
  entries:       LearningMemoryEntry[];
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-6 py-10 text-center">
        <p className="text-3xl">◈</p>
        <p className="mt-2 text-sm font-medium text-slate-300">No learnings yet</p>
        <p className="mt-1 text-xs text-slate-500">
          {emptyMessage ?? "Run experiments, sync Meta data, and ensure reconciliation has completed to generate learnings."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <LearningCard key={e.id} entry={e} />
      ))}
    </div>
  );
}

// ── Category-grouped list (desktop-optimised) ─────────────────────────────────

function CategoryGroup({
  category,
  entries,
}: {
  category: LearningCategory;
  entries:  LearningMemoryEntry[];
}) {
  const accent = CATEGORY_ACCENT[category] ?? "text-slate-400";
  const label  = CATEGORY_LABEL[category]  ?? category;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className={`text-xs font-semibold uppercase tracking-widest ${accent}`}>{label}</h3>
        <span className="text-xs text-slate-600">{entries.length}</span>
      </div>
      <div className="space-y-2">
        {entries.map((e) => (
          <LearningCard key={e.id} entry={e} />
        ))}
      </div>
    </div>
  );
}

export function GroupedLearningsList({
  groups,
}: {
  groups: Array<{ category: LearningCategory; entries: LearningMemoryEntry[] }>;
}) {
  if (groups.length === 0) {
    return (
      <FlatLearningsList entries={[]} />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ category, entries }) => (
        <CategoryGroup key={category} category={category} entries={entries} />
      ))}
    </div>
  );
}
