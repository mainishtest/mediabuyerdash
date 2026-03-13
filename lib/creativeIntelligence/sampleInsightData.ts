// Sample Creative Intelligence Data
//
// Used when no real generated variations exist in the database yet.
// Demonstrates what the intelligence layer looks like with real data.
// Each entry covers a distinct pattern type so all categories populate.

import type { RawCopyInput, RawImageInput } from "./signals";

export const SAMPLE_COPY_INPUTS: RawCopyInput[] = [
  {
    id: "sample-c1",
    title: "Story Hook — Transformation",
    hook: "When I first tried this, I couldn't believe the results",
    body: "Like thousands of others, I was struggling with the same problem. After making one small change, everything shifted.",
    callToAction: "Claim your free trial",
  },
  {
    id: "sample-c2",
    title: "Pain Hook — Problem/Solution",
    hook: "Tired of paying too much and getting too little?",
    body: "The problem with most solutions is they don't fix the root issue. This one does.",
    callToAction: "Discover the difference",
  },
  {
    id: "sample-c3",
    title: "Question Hook — Social Proof",
    hook: "Are you making this common mistake?",
    body: "Thousands of customers trusted us and completely transformed their results.",
    callToAction: "Learn more",
  },
  {
    id: "sample-c4",
    title: "Transformation Hook — Benefit",
    hook: "From struggling every day to hitting their goals — here's what changed",
    body: "After years of trying, they finally found the approach that works. Real results, real people.",
    callToAction: "Shop now",
  },
  {
    id: "sample-c5",
    title: "Urgency Hook — Urgency Body",
    hook: "Last chance — this offer expires tonight",
    body: "Limited availability. Don't wait. Only a few left at this price today.",
    callToAction: "Order now before it's gone",
  },
  {
    id: "sample-c6",
    title: "Stat Hook — Emotional",
    hook: "87% of buyers say this is the #1 factor in their decision",
    body: "Research shows the right offer can make you feel confident and in control.",
    callToAction: "Get started free",
  },
];

export const SAMPLE_IMAGE_INPUTS: RawImageInput[] = [
  {
    id: "sample-i1",
    title: "UGC Authentic",
    conceptSummary: "Show a real person holding the product in an authentic UGC-style selfie shot. Phone shot aesthetic, natural lighting.",
    visualChanges: "Remove polished studio look. Add raw, authentic feel with natural background.",
  },
  {
    id: "sample-i2",
    title: "Before & After Comparison",
    conceptSummary: "Side-by-side before and after comparison image showing transformation results.",
    visualChanges: "Split panel layout — before on the left, after on the right.",
  },
  {
    id: "sample-i3",
    title: "Testimonial Quote",
    conceptSummary: "Testimonial-style image with a real person and bold quote text overlay.",
    visualChanges: "Person featured prominently, testimonial text clearly readable.",
  },
  {
    id: "sample-i4",
    title: "Lifestyle Scene",
    conceptSummary: "Show the product in a lifestyle setting — in-use scene with natural background.",
    visualChanges: "Warm tones, aspirational feel, product visible but not center stage.",
  },
  {
    id: "sample-i5",
    title: "Product Showcase",
    conceptSummary: "Clean product close-up showcase. Feature the key ingredient or product detail.",
    visualChanges: "White background, sharp detail, product centered and well-lit.",
  },
  {
    id: "sample-i6",
    title: "Minimalist Text",
    conceptSummary: "Clean minimal background with bold headline text overlay. Simple and elegant.",
    visualChanges: "White space, large readable font, single focus element.",
  },
];
