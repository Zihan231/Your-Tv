import { fetchAll } from '@/lib/api';
import { loadMrgifyJson, loadMrgifyM3u } from '@/lib/mrgifyApi';
import { loadBingstreamM3u, parseBingstreamChannels } from '@/lib/bingstreamApi';
import {
  loadOopsTvSportsS1,
  loadOopsTvBdTest,
  mergeOopsTvChannels,
} from '@/lib/oopsTvApi';
import {
  buildCategories,
  buildChannels,
  mergeMrgifyChannels,
} from '@/lib/streamUtils';
import IPTVPlayer from '@/components/IPTVPlayer';

export const dynamic = 'force-static';

export default async function Page() {
  const [data, mrgifyJson, m3uText, bingstreamM3u, oopsSportsM3u, oopsBdM3u] =
    await Promise.all([
      fetchAll(),
      loadMrgifyJson(),
      loadMrgifyM3u(),
      loadBingstreamM3u(),
      loadOopsTvSportsS1(),
      loadOopsTvBdTest(),
    ]);

  const blockedIds = new Set(data.blocklist.map((b) => b.channel));
  const baseChannels = buildChannels(
    data.channels,
    data.streams,
    data.logos,
    blockedIds,
  );

  const mrgifyMerged = mergeMrgifyChannels(
    baseChannels,
    mrgifyJson,
    m3uText,
    data.logos,
  );

  const bingstreamChannels = parseBingstreamChannels(bingstreamM3u);

  // Combine live events + mrgify channels
  let channels = [...bingstreamChannels, ...mrgifyMerged];

  // Merge OopsTv sports-s1 channels
  channels = mergeOopsTvChannels(channels, oopsSportsM3u, 'sports');

  // Merge OopsTv bd-test channels
  channels = mergeOopsTvChannels(channels, oopsBdM3u);

  const categories = [
    { id: 'live-events', name: 'Live Sports ⚽' },
    ...data.categories,
  ];

  const counts = buildCategories(categories, channels);

  return (
    <IPTVPlayer
      initialChannels={channels}
      categories={categories}
      categoryCounts={counts}
    />
  );
}