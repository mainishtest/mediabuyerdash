// Video Ad Generator — Anthropic caller
//
// Thin wrapper over the Anthropic Messages API. Returns parsed JSON when
// `expectJson` is set. Uses the same env var (ANTHROPIC_API_KEY) as the
// existing providerExecution module, but is kept isolated so this module
// can evolve independently.

const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL     = "claude-sonnet-4-20250514";

export class VideoAdGenError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "VideoAdGenError";
  }
}

interface CallArgs {
  system:    string;
  user:      string;
  maxTokens?: number;
  model?:    string;
}

interface RawResponse {
  content?: Array<{ type: string; text?: string }>;
}

async function callAnthropicRaw({ system, user, maxTokens = 2048, model }: CallArgs): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new VideoAdGenError(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable video ad generation."
    );
  }

  const chosenModel = model ?? process.env.VIDEO_AD_GEN_MODEL ?? DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model:      chosenModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
  } catch (err) {
    throw new VideoAdGenError("Network error calling Anthropic", err);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "<unreadable>");
    throw new VideoAdGenError(`Anthropic ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as RawResponse;
  const text = json.content?.find((c) => c.type === "text")?.text;
  if (!text) {
    throw new VideoAdGenError("Anthropic returned no text content");
  }
  return text;
}

export async function callAnthropicJson<T>(args: CallArgs): Promise<T> {
  const text = await callAnthropicRaw(args);
  // Accept either raw JSON or a fenced ```json block.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // Find the outermost JSON braces or brackets if the model added prose.
  const firstBrace  = cleaned.search(/[{\[]/);
  const lastClose   = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  const jsonSlice   = firstBrace >= 0 && lastClose > firstBrace
    ? cleaned.slice(firstBrace, lastClose + 1)
    : cleaned;

  try {
    return JSON.parse(jsonSlice) as T;
  } catch (err) {
    throw new VideoAdGenError(
      `Failed to parse Anthropic JSON response: ${(err as Error).message}. Raw: ${text.slice(0, 300)}`
    );
  }
}
