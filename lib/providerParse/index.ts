// Provider Response Parsing Layer
//
// Exports for converting provider-specific responses into normalized internal models.

export {
  parseOpenAICopyResponse,
  parseAnthropicCopyResponse,
  parsePlaceholderImageResponse,
  parseProviderResponse,
  toParsedPreview
} from "./parsers";

export {
  MOCK_OPENAI_COPY_RESPONSE,
  MOCK_ANTHROPIC_COPY_RESPONSE,
  MOCK_PLACEHOLDER_IMAGE_RESPONSE
} from "./mockResponses";
