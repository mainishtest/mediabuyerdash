import { getMetaLaunchOptionsAction, getConceptPrefillAction, getAssetPrefillAction, getDraftPrefillAction, getAvailableAssetsAction } from "./actions";
import { LauncherView } from "./LauncherView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Campaign Launcher — Media Buying Dashboard",
};

interface Props {
  searchParams: Promise<{ conceptId?: string; assetId?: string; draftId?: string }>;
}

export default async function LaunchPage({ searchParams }: Props) {
  const params = await searchParams;
  const [options, assets] = await Promise.all([
    getMetaLaunchOptionsAction(),
    getAvailableAssetsAction(),
  ]);

  // Prefill from operator agent draft, concept, or asset
  let prefill = null;
  if (params.draftId) {
    prefill = await getDraftPrefillAction(params.draftId);
  } else if (params.conceptId) {
    prefill = await getConceptPrefillAction(params.conceptId);
  } else if (params.assetId) {
    prefill = await getAssetPrefillAction(params.assetId);
  }

  return <LauncherView options={options} prefill={prefill} assets={assets} />;
}
