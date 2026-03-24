// Provider Execution Config
//
// Validates environment variables for provider credentials.
// Fails gracefully when providers are not configured.

import type { ProviderAdapterType } from "../../types/providerFormat";

export interface ProviderConfigStatus {
  ready:     boolean;
  message:   string;
  apiKey?:   string;
  model?:    string;
}

export function getOpenAIConfig(): ProviderConfigStatus {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    return {
      ready:   false,
      message: "OPENAI_API_KEY is not set. Add it to .env.local to enable OpenAI."
    };
  }

  return {
    ready:   true,
    message: "OpenAI configured",
    apiKey:  apiKey.trim(),
    model:   model.trim()
  };
}

export function getAnthropicConfig(): ProviderConfigStatus {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001";

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    return {
      ready:   false,
      message: "ANTHROPIC_API_KEY is not set. Add it to .env.local to enable Anthropic."
    };
  }

  return {
    ready:   true,
    message: "Anthropic configured",
    apiKey:  apiKey.trim(),
    model:   model.trim()
  };
}

export function getImagePlaceholderConfig(): ProviderConfigStatus {
  return {
    ready:   true,
    message: "Image provider is a placeholder. Real image execution not yet implemented."
  };
}

export function getProviderConfig(provider: ProviderAdapterType): ProviderConfigStatus {
  switch (provider) {
    case "openai_text":
      return getOpenAIConfig();
    case "anthropic_text":
      return getAnthropicConfig();
    case "image_provider_placeholder":
      return getImagePlaceholderConfig();
    default:
      return { ready: false, message: `Unknown provider: ${provider}` };
  }
}

export function isProviderReady(provider: ProviderAdapterType): boolean {
  return getProviderConfig(provider).ready;
}
