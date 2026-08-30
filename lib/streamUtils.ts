import type {
  Channel,
  RawChannel,
  RawLogo,
  RawStream,
  Stream,
} from '@/types/iptv';

function toStream(raw: RawStream): Stream {
  return {
    url: raw.url,
    quality: raw.quality ?? null,
    label: raw.label ?? null,
    referrer: raw.referrer ?? null,
    user_agent: raw.user_agent ?? null,
  };
}

export function buildChannels(
  rawChannels: RawChannel[],
  rawStreams: RawStream[],
  rawLogos: RawLogo[],
  blockedIds: Set<string>,
): Channel[] {
  const streamsByChannel = new Map<string, Stream[]>();
  for (const raw of rawStreams) {
    if (!raw.channel || !raw.url) continue;
    const list = streamsByChannel.get(raw.channel) ?? [];
    list.push(toStream(raw));
    streamsByChannel.set(raw.channel, list);
  }

  const logosByChannel = new Map<string, string>();
  for (const logo of rawLogos) {
    if (!logo.channel || !logo.url) continue;
    if (logo.in_use === false) continue;
    if (!logosByChannel.has(logo.channel)) {
      logosByChannel.set(logo.channel, logo.url);
    }
  }

  const channels: Channel[] = [];

  for (const raw of rawChannels) {
    if (raw.is_nsfw) continue;
    if (blockedIds.has(raw.id)) continue;

    const streams = streamsByChannel.get(raw.id);
    if (!streams || streams.length === 0) continue;

    channels.push({
      id: raw.id,
      name: raw.name,
      categories: raw.categories ?? [],
      country: raw.country ?? '',
      logo: logosByChannel.get(raw.id) ?? null,
      streams,
    });
  }

  return channels;
}

export function buildCategories(
  categories: { id: string; name: string }[],
  channels: Channel[],
): Map<string, number> {
  const count = new Map<string, number>();
  for (const cat of categories) count.set(cat.id, 0);

  for (const channel of channels) {
    if (!channel.categories) continue;
    for (const cat of channel.categories) {
      count.set(cat, (count.get(cat) ?? 0) + 1);
    }
  }
  return count;
}