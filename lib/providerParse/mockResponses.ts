// Mock Provider Response Payloads
//
// Realistic samples for testing the parser layer. No real API calls.
// Aligned with OpenAI, Anthropic, and placeholder image provider shapes.

// ── OpenAI-style copy response ─────────────────────────────────────────────────
// Simulates GPT-4 chat completion with structured JSON in content

export const MOCK_OPENAI_COPY_RESPONSE = {
  id: "chatcmpl-mock123",
  object: "chat.completion",
  created: 1710000000,
  model: "gpt-4o",
  choices: [
    {
      index: 0,
      message: {
        role: "assistant",
        content: JSON.stringify({
          variations: [
            {
              id: "cv_openai_1",
              title: "Pain Point Hook",
              hook: "Tired of results that vanish after 30 days?",
              body: "Our system works with your body's natural rhythm — not against it. Backed by 3 clinical studies and trusted by 14,000+ customers. See the difference in 7 days.",
              callToAction: "See How It Works"
            },
            {
              id: "cv_openai_2",
              title: "Transformation Story",
              hook: "I was skeptical — then I tried it for 7 days.",
              body: "Real talk: I've tried everything. This is the first thing that actually worked. Here's exactly what happened and why I'm still using it 6 months later.",
              callToAction: "Watch My Story"
            },
            {
              id: "cv_openai_3",
              title: "Specificity Angle",
              hook: "Stop overpaying for results that disappear.",
              body: "Get compounding results because our formula works with your body — not against it. 3 clinical studies. 14,000+ customers. 7-day trial.",
              callToAction: "Try It Risk-Free"
            }
          ]
        })
      },
      finish_reason: "stop"
    }
  ],
  usage: { prompt_tokens: 450, completion_tokens: 280, total_tokens: 730 }
};

// ── Anthropic-style copy response ──────────────────────────────────────────────
// Simulates Claude API with content array

export const MOCK_ANTHROPIC_COPY_RESPONSE = {
  id: "msg_mock456",
  type: "message",
  role: "assistant",
  content: [
    {
      type: "text",
      text: JSON.stringify({
        variations: [
          {
            id: "cv_anthropic_1",
            title: "Direct Benefit Hook",
            hook: "Get results that last — not just for 30 days.",
            body: "Our system delivers compounding results because it works with your body's natural rhythm. Backed by clinical studies and trusted by thousands.",
            callToAction: "Learn More"
          },
          {
            id: "cv_anthropic_2",
            title: "Problem-Solution",
            hook: "Overpaying for temporary results?",
            body: "Stop wasting money on solutions that fade. Our approach works with your body — 3 studies, 14K+ customers, real results you can measure.",
            callToAction: "See The Science"
          },
          {
            id: "cv_anthropic_3",
            title: "Credibility First",
            hook: "3 clinical studies. 14,000+ customers. One system.",
            body: "Real results that compound over time. Our formula works with your body's natural rhythm — not against it. Try it risk-free for 7 days.",
            callToAction: "Start Free Trial"
          }
        ]
      })
    }
  ],
  model: "claude-3-5-sonnet-20241022",
  stop_reason: "end_turn",
  usage: { input_tokens: 520, output_tokens: 260 }
};

// ── Placeholder image variation response ───────────────────────────────────────
// Simulates image concept provider output

export const MOCK_PLACEHOLDER_IMAGE_RESPONSE = {
  id: "img_mock789",
  status: "completed",
  concepts: [
    {
      id: "iv_placeholder_1",
      title: "Single Focal Point",
      conceptSummary: "Product centered with strong contrast against clean white background. One clear subject, no competing elements.",
      visualChanges: "Remove text overlay clutter. Increase product size. Use high-contrast background.",
      goal: "Test whether a single focal point outperforms busy layouts"
    },
    {
      id: "iv_placeholder_2",
      title: "Lifestyle Context",
      conceptSummary: "Product in use within a relatable lifestyle setting. Person holding or using the product with natural lighting.",
      visualChanges: "Add lifestyle context. Warmer lighting. Human element to show scale and use case.",
      goal: "Test whether lifestyle imagery improves message-to-market fit"
    },
    {
      id: "iv_placeholder_3",
      title: "Before/After Visual",
      conceptSummary: "Split image showing transformation or comparison. Clear visual communication of the benefit.",
      visualChanges: "Split layout. Side-by-side or before/after. Emphasize the outcome visually.",
      goal: "Test whether transformation imagery drives action"
    }
  ],
  metadata: {
    adId: "ad_lab_1",
    campaignId: "camp_1",
    requestType: "image_variation_generation"
  }
};
