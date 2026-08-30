import { fetchAll } from '@/lib/api';
import { buildCategories, buildChannels } from '@/lib/streamUtils';
import IPTVPlayer from '@/components/IPTVPlayer';

export const dynamic = 'force-static';

export default async function Page() {
  const data = await fetchAll();

  const blockedIds = new Set(data.blocklist.map((b) => b.channel));
  const channels = buildChannels(
    data.channels,
    data.streams,
    data.logos,
    blockedIds,
  );

  const counts = buildCategories(data.categories, channels);

  return (
    <IPTVPlayer
      initialChannels={channels}
      categories={data.categories}
      categoryCounts={counts}
    />
  );
}