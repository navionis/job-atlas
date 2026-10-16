import { snapshot } from "../../../lib/feeds";
import SourcesClient from "./sources-client";
export const dynamic = "force-dynamic";
export default async function SourcesPage() {
  const initial = await snapshot().catch(() => ({
    jobs: [],
    sources: [],
    statuses: {},
    updatedAt: 0,
  }));
  return <SourcesClient initial={initial} />;
}
