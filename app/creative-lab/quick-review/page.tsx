export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { QuickReviewLaunchView } from "./QuickReviewLaunchView";

export const metadata = {
  title: "Quick Review & Launch — Creative Lab",
};

export default function QuickReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-500">Loading review...</div>
      }
    >
      <QuickReviewLaunchView />
    </Suspense>
  );
}
