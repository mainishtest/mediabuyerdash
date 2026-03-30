export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { UploadSourceAssetView } from "./UploadSourceAssetView";

export const metadata = {
  title: "Upload Source Asset — Creative Lab",
};

export default function UploadSourceAssetPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading Upload...</div>}>
      <UploadSourceAssetView />
    </Suspense>
  );
}
