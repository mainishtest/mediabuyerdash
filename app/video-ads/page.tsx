import { listConcepts } from "./actions";
import { LibraryView } from "./LibraryView";
import { prisma } from "../../lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Video Ad Generator — Media Buying Dashboard",
};

export default async function VideoAdsLibraryPage() {
  const concepts = await listConcepts().catch(() => []);

  // Get engine versions for all concepts (not on the hydrated type)
  const rawConcepts = await prisma.videoAdConcept.findMany({
    select: { id: true, engineVersion: true },
  }).catch(() => []);
  const engineMap = new Map(rawConcepts.map((r) => [r.id, (r as Record<string, unknown>).engineVersion as string ?? "v1"]));

  // Serialize for client component
  const cards = concepts.map((c) => ({
    id:            c.id,
    title:         c.title,
    status:        c.status,
    platform:      c.platform,
    adStyle:       c.adStyle,
    productName:   c.productName,
    bigIdea:       c.angle?.bigIdea ?? null,
    hookCount:     c.hooks?.length ?? 0,
    engineVersion: engineMap.get(c.id) ?? "v1",
    createdAt:     c.createdAt.toISOString(),
  }));

  return <LibraryView concepts={cards} />;
}
