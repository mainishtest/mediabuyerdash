import Link from "next/link";
import { NewConceptFormV2 } from "./NewConceptFormV2";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "New Video Ad Concept — Media Buying Dashboard",
};

export default function NewConceptPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-8">
        <Link
          href="/video-ads"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
          Back to library
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          New Concept
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Two-engine generation: GPT-5.4 strategy layer + Veo render brief compiler.
          Platform-optimized outputs for Facebook and Rumble.
        </p>
      </div>

      <NewConceptFormV2 />
    </div>
  );
}
