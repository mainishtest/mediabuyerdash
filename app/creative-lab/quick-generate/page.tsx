export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { QuickGenerateView } from "./QuickGenerateView";

export const metadata = {
  title: "Quick Generate — Creative Lab",
};

export default function QuickGeneratePage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading Quick Generate...</div>}>
      <QuickGenerateView />
    </Suspense>
  );
}
