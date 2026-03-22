"use client";

// TimelineList — reverse-chronological timeline of action history entries.
// Groups by date, shows event type, status, actor, entity, and outcome links.
// Supports entry selection for detail drawer.

import type {
  ActionHistoryGroup,
  ActionHistoryTimelineItem,
  ActionHistoryEventType,
  ActionHistoryStatus,
} from "../../../types/actionHistory";

// ── Helpers ─────────────────────────────────────────────────────────────────

function eventTypeLabel(t: ActionHistoryEventType): string {
  const map: Record<string, string> = {
    recommendation_created:     "Recommendation",
    approval_requested:         "Approval Requested",
    approval_granted:           "Approved",
    approval_rejected:          "Rejected",
    approval_deferred:          "Deferred",
    scale_plan_created:         "Scale Plan",
    scale_executed:             "Scale Executed",
    budget_changed:             "Budget Changed",
    test_created:               "Test Created",
    test_launched:              "Test Launched",
    creative_refresh_sent:      "Creative Refresh",
    image_generation_completed: "Image Generated",
    creative_status_changed:    "Creative Update",
    outcome_routed:             "Outcome Routed",
    execution_succeeded:        "Executed",
    execution_failed:           "Failed",
    launch_failed:              "Launch Failed",
    action_blocked:             "Blocked",
    emergency_stopped:          "Emergency Stop",
    retry_started:              "Retry Started",
    retry_succeeded:            "Retry Succeeded",
    digest_delivered:           "Digest Sent",
    alert_delivered:            "Alert Sent",
  };
  return map[t] ?? t.replace(/_/g, " ");
}

function eventTypeBadgeColor(t: ActionHistoryEventType): string {
  if (t === "approval_granted" || t === "execution_succeeded" || t === "scale_executed" || t === "retry_succeeded") {
    return "bg-emerald-500/10 text-emerald-400";
  }
  if (t === "execution_failed" || t === "launch_failed") return "bg-rose-500/10 text-rose-400";
  if (t === "action_blocked" || t === "emergency_stopped") return "bg-rose-500/10 text-rose-400";
  if (t === "approval_rejected") return "bg-amber-500/10 text-amber-400";
  if (t === "outcome_routed") return "bg-indigo-500/10 text-indigo-400";
  if (t === "test_created" || t === "test_launched" || t === "creative_refresh_sent" || t === "image_generation_completed" || t === "creative_status_changed") {
    return "bg-cyan-500/10 text-cyan-400";
  }
  if (t === "scale_plan_created" || t === "budget_changed") return "bg-violet-500/10 text-violet-400";
  if (t === "approval_requested" || t === "approval_deferred") return "bg-sky-500/10 text-sky-400";
  return "bg-slate-700/50 text-slate-400";
}

function statusDot(status: ActionHistoryStatus): string {
  switch (status) {
    case "success":     return "bg-emerald-400";
    case "failed":      return "bg-rose-400";
    case "blocked":     return "bg-rose-400";
    case "pending":     return "bg-amber-400";
    case "in_progress": return "bg-sky-400";
    case "skipped":     return "bg-slate-500";
    default:            return "bg-slate-500";
  }
}

function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    automation_audit: "Automation",
    proposed_action:  "Action",
    execution_log:    "Execution",
    creative_lab:     "Creative Lab",
    outcome_route:    "Outcome",
    notification_log: "Notification",
  };
  return map[source] ?? source;
}

// ── Timeline entry ──────────────────────────────────────────────────────────

function TimelineEntry({
  item,
  isSelected,
  onSelect,
}: {
  item:       ActionHistoryTimelineItem;
  isSelected: boolean;
  onSelect:   () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group flex w-full gap-3 rounded-lg border text-left
                 px-4 py-3 transition-colors
                 ${isSelected
                   ? "border-emerald-800/60 bg-emerald-950/20"
                   : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-800/50"
                 }`}
    >
      {/* Status dot + connector line */}
      <div className="flex flex-col items-center pt-0.5">
        <div className={`h-2.5 w-2.5 rounded-full ${statusDot(item.status)}`} />
        <div className="mt-1 h-full w-px bg-slate-800" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Top row: badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${eventTypeBadgeColor(item.eventType)}`}>
            {eventTypeLabel(item.eventType)}
          </span>
          <span className="text-[10px] text-slate-600">{sourceLabel(item.source)}</span>
          <span className="text-[10px] text-slate-600">{item.timeLabel}</span>
          {item.actor.type !== "system" && (
            <span className="text-[10px] text-slate-500">{item.actor.label}</span>
          )}
        </div>

        {/* Title */}
        <p className="mt-1 text-sm font-medium text-slate-200 group-hover:text-white">
          {item.title}
        </p>

        {/* Description */}
        <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{item.description}</p>

        {/* Bottom row: entity, client, outcome */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            {item.entity.entityName}
          </span>
          {item.clientName && (
            <span className="text-[10px] text-slate-600">{item.clientName}</span>
          )}
          {item.outcomeLink && (
            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
              {item.outcomeLink.label}
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <div className="mt-1 flex-shrink-0 text-slate-700 transition-colors group-hover:text-slate-500">
        <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

// ── Date group ──────────────────────────────────────────────────────────────

function DateGroup({
  group,
  selectedId,
  onSelectEntry,
}: {
  group:          ActionHistoryGroup;
  selectedId:     string | null;
  onSelectEntry:  (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{group.label}</h3>
        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600">{group.items.length}</span>
      </div>
      <div className="space-y-2">
        {group.items.map((item) => (
          <TimelineEntry
            key={item.id}
            item={item}
            isSelected={item.id === selectedId}
            onSelect={() => onSelectEntry(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main list ───────────────────────────────────────────────────────────────

export function TimelineList({
  groups,
  onSelectEntry,
  selectedId,
}: {
  groups:         ActionHistoryGroup[];
  onSelectEntry:  (id: string) => void;
  selectedId:     string | null;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-6 py-12 text-center">
        <p className="text-sm text-slate-500">No action history found.</p>
        <p className="mt-1 text-xs text-slate-600">
          Actions will appear here as the system processes approvals, tests, and outcomes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <DateGroup
          key={group.date}
          group={group}
          selectedId={selectedId}
          onSelectEntry={onSelectEntry}
        />
      ))}
    </div>
  );
}
