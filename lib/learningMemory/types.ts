// ─── Learning Memory — Typed Models ──────────────────────────────────────────
//
// Unified type system for the creative and experiment learning memory layer.
// All types are pure definitions — no business logic.

// ── Source types ──────────────────────────────────────────────────────────────

export type LearningSourceType =
  | "creative_outcome"        // from ReconciledCampaignPerformance vs goals
  | "experiment_outcome"      // from ExperimentLearningRecord
  | "fatigue_outcome"         // derived from high-frequency MetaSyncedInsight patterns
  | "recommendation_outcome"  // from executed ProposedAutomationAction
  | "publish_outcome";        // from PublishPrepRecord (publishedAt set)

// ── Category ──────────────────────────────────────────────────────────────────

export type LearningCategory =
  | "winning_hook"             // specific hook / opening pattern that drove CTR
  | "winning_angle"            // angle / message frame that drove ROAS
  | "winning_offer_framing"    // offer or CTA framing that drove conversions
  | "fatigue_pattern"          // pattern associated with creative wear-out
  | "poor_performer_pattern"   // pattern associated with underperformance
  | "audience_message_fit"     // message ↔ audience alignment signal
  | "launch_condition"         // conditions associated with stronger launches
  | "refresh_pattern"          // which refresh intents are being used
  | "experiment_pattern";      // general experiment outcome pattern

// ── Confidence ────────────────────────────────────────────────────────────────

export type LearningConfidence = "low" | "medium" | "high";

// ── Evidence signal ───────────────────────────────────────────────────────────

export type LearningSignal = {
  label:     string;
  value:     string;
  direction: "positive" | "negative" | "neutral";
};

// ── Related entity reference ──────────────────────────────────────────────────

export type LearningEntity = {
  type:  string; // "experiment" | "campaign" | "creative" | "brief" | "automation"
  id:    string;
  label: string;
};

// ── Core entry ────────────────────────────────────────────────────────────────

export type LearningMemoryEntry = {
  id:              string;
  sourceType:      LearningSourceType;
  category:        LearningCategory;
  confidence:      LearningConfidence;
  clientId:        string;
  clientName:      string;
  campaignId:      string | null;
  campaignName:    string | null;
  insightText:     string;     // 1-2 human-readable sentences
  pattern:         string | null; // short machine label, e.g. "high_roas_angle"
  evidence:        LearningSignal[];
  relatedEntities: LearningEntity[];
  usableForBriefs:  boolean;
  usableForScoring: boolean;
  createdAt:       string;
  periodFrom:      string | null;
  periodTo:        string | null;
};

// ── Pattern ───────────────────────────────────────────────────────────────────

export type LearningPattern = {
  patternLabel:    string;
  category:        LearningCategory;
  occurrences:     number;
  confidence:      LearningConfidence;
  exampleInsight:  string;
  clientNames:     string[];
  sourceTypes:     LearningSourceType[];
};

// ── Insight (synthesised from multiple entries) ───────────────────────────────

export type LearningInsight = {
  headline:       string;
  supportingCount: number;
  confidence:     LearningConfidence;
  categories:     LearningCategory[];
};

// ── Query ─────────────────────────────────────────────────────────────────────

export type LearningQuery = {
  clientId?:        string;
  campaignId?:      string;
  dateFrom?:        string;
  dateTo?:          string;
  sourceType?:      LearningSourceType;
  category?:        LearningCategory;
  confidence?:      LearningConfidence;
  usableForBriefs?: boolean;
  limit?:           number;
};

// ── Surface context (for integration with other workflows) ────────────────────

export type LearningSurfaceContext = {
  workflowType: "creative_brief" | "experiment_planning" | "executive_narrative" | "recommendation";
  clientId?:    string;
  campaignId?:  string;
  intent?:      string;    // creative brief intent
  draftType?:   string;    // creative draft type
};

// ── Summary ───────────────────────────────────────────────────────────────────

export type LearningSummary = {
  totalEntries:          number;
  highConfidenceCount:   number;
  experimentCount:       number;
  creativeCount:         number;
  usableForBriefsCount:  number;
  topPatterns:           LearningPattern[];
  topInsight:            string | null;   // single headline sentence
  clientsWithLearnings:  { id: string; name: string; count: number }[];
  isSparse:              boolean;         // true if totalEntries < 5
};
