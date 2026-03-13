// Provider Formatting Adapter Layer
//
// Exports for converting internal prompts into provider-specific payloads.

export {
  formatCopyPromptForOpenAI,
  formatCopyPromptForAnthropic,
  formatImagePromptForPlaceholderProvider,
  formatForProvider,
  toPayloadPreview
} from "./adapters";
