// Video Ad Generator — OpenAI caller (v2 strategy engine)
//
// Thin wrapper over OpenAI Chat Completions API for the GPT strategy
// layer. Mirrors the pattern in anthropic.ts: raw fetch, JSON parsing,
// configurable model via env vars.

import { VideoAdGenError } from "./anthropic";
import type { GenerationTier } from "./types";

const DEFAULT_PREMIUM_MODEL  = "gpt-4o";
const DEFAULT_STANDARD_MODEL = "gpt-4o-mini";

interface CallArgs {
  system:    string;
  user:      string;
  maxTokens?: number;
  tier?:     GenerationTier;
  model?:    string;
}

interface OpenAIResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  error?: { message?: string; type?: string };
}

function getModel(tier: GenerationTier = "premium", explicit?: string): string {
  if (explicit) return explicit;
  if (tier === "standard") {
    return process.env.OPENAI_VIDEO_AD_STANDARD_MODEL ?? DEFAULT_STANDARD_MODEL;
  }
  return process.env.OPENAI_VIDEO_AD_PREMIUM_MODEL ?? DEFAULT_PREMIUM_MODEL;
}

async function callOpenAIRaw({ system, user, maxTokens = 4096, tier, model }: CallArgs): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new VideoAdGenError(
      "OPENAI_API_KEY is not set. Add it to .env.local to enable GPT strategy generation."
    );
  }

  const chosenModel = getModel(tier, model);

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:      chosenModel,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user",   content: user },
        ],
      }),
    });
  } catch (err) {
    throw new VideoAdGenError("Network error calling OpenAI", err);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<unreadable>");
    throw new VideoAdGenError(`OpenAI ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as OpenAIResponse;

  if (json.error) {
    throw new VideoAdGenError(`OpenAI error: ${json.error.message ?? json.error.type}`);
  }

  const text = json.choices?.[0]?.message?.content;
  if (!text) {
    throw new VideoAdGenError("OpenAI returned no content");
  }
  return text;
}

export async function callOpenAIJson<T>(args: CallArgs): Promise<T> {
  const text = await callOpenAIRaw(args);

  // Clean fenced blocks if present (shouldn't be with response_format, but safety net)
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const firstBrace = cleaned.search(/[{\[]/);
  const lastClose  = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  const jsonSlice  = firstBrace >= 0 && lastClose > firstBrace
    ? cleaned.slice(firstBrace, lastClose + 1)
    : cleaned;

  try {
    return JSON.parse(jsonSlice) as T;
  } catch (err) {
    throw new VideoAdGenError(
      `Failed to parse OpenAI JSON response: ${(err as Error).message}. Raw: ${text.slice(0, 300)}`
    );
  }
}
