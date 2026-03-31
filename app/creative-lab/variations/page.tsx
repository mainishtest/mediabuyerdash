export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { VariationGeneratorView } from "./VariationGeneratorView";

export const metadata = {
  title: "Generate Variations — Creative Lab",
};

export default function VariationsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-slate-500">Loading variation generator...</div>
      }
    >
      <VariationGeneratorView />
    </Suspense>
  );
}
