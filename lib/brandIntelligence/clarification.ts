// lib/brandIntelligence/clarification.ts
// Generates smart clarification questions when brand context is sparse.
// Pure function — no DB, no side effects.
//
// Design rules:
//   - Ask as few questions as possible (max 5).
//   - Default to smart inference first — only ask when truly needed.
//   - Questions map to specific fields in the brand memory.

import type {
  BrandClarificationQuestion,
  BrandMemoryData,
  BrandPromptSummary,
  CREATIVE_STYLE_OPTIONS,
} from "../../types/brandIntelligence";

// ---------------------------------------------------------------------------
// Question bank — ordered by importance
// ---------------------------------------------------------------------------

const QUESTION_BANK: BrandClarificationQuestion[] = [
  {
    id:        "ideal_customer",
    question:  "Who is the ideal customer for this product?",
    hint:      "E.g. \"busy moms 30-45\" or \"male fitness enthusiasts 25-40\"",
    fieldKey:  "audience.description",
    inputType: "text",
    options:   null,
    required:  false,
  },
  {
    id:        "main_problem",
    question:  "What is the main problem this product solves?",
    hint:      "One sentence — the core pain point your customer feels",
    fieldKey:  "offerSummary.mainProblem",
    inputType: "text",
    options:   null,
    required:  false,
  },
  {
    id:        "creative_style",
    question:  "What style do you want for these ads?",
    hint:      null,
    fieldKey:  "stylePreference",
    inputType: "select",
    options:   [
      "Aggressive Direct Response",
      "Clean Premium Brand",
      "UGC / Native Style",
      "Product Focused",
    ],
    required:  false,
  },
  {
    id:        "avoid",
    question:  "Is there anything we should avoid in the ads?",
    hint:      "Words, topics, competitors, or styles to steer away from",
    fieldKey:  "avoidList",
    inputType: "text",
    options:   null,
    required:  false,
  },
  {
    id:        "reference_vibe",
    question:  "What should these ads feel more like?",
    hint:      "Describe a brand, competitor, or ad style you admire",
    fieldKey:  "referenceNotes",
    inputType: "text",
    options:   null,
    required:  false,
  },
];

// ---------------------------------------------------------------------------
// Public API: generate clarification questions based on current state
// ---------------------------------------------------------------------------

export function generateClarificationQuestions(
  memory: BrandMemoryData | null,
  summary: BrandPromptSummary,
): BrandClarificationQuestion[] {
  // If context is rich enough, no questions needed
  if (summary.completeness >= 80) return [];

  const questions: BrandClarificationQuestion[] = [];

  // Only ask questions for fields that are actually missing
  const hasAudience = memory?.audience?.description
    && memory.audience.description !== "Target customer for this product";
  if (!hasAudience) {
    questions.push(QUESTION_BANK.find((q) => q.id === "ideal_customer")!);
  }

  const hasProblem = !!memory?.offerSummary?.mainProblem;
  if (!hasProblem) {
    questions.push(QUESTION_BANK.find((q) => q.id === "main_problem")!);
  }

  const hasStyle = !!memory?.stylePreference;
  if (!hasStyle) {
    questions.push(QUESTION_BANK.find((q) => q.id === "creative_style")!);
  }

  // Only ask avoid/reference if we already have the essentials
  if (questions.length <= 2) {
    const hasAvoid = memory?.avoidList && memory.avoidList.length > 0;
    if (!hasAvoid) {
      questions.push(QUESTION_BANK.find((q) => q.id === "avoid")!);
    }
  }

  if (questions.length <= 3) {
    const hasRef = !!memory?.referenceNotes;
    if (!hasRef) {
      questions.push(QUESTION_BANK.find((q) => q.id === "reference_vibe")!);
    }
  }

  // Cap at 5 questions max
  return questions.slice(0, 5);
}
