import type {
  RawBlocked,
  RawCategory,
  RawChannel,
  RawLogo,
  RawStream,
} from '@/types/iptv';

const BASE = 'https://iptv-org.github.io/api';

export interface ApiData {
  channels: RawChannel[];
  streams: RawStream[];
  categories: RawCategory[];
  logos: RawLogo[];
  blocklist: RawBlocked[];
}

let cached: ApiData | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: 'force-cache' });
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchAll(): Promise<ApiData> {
  if (cached) return cached;

  const result: ApiData = await Promise.all([
    fetchJson<RawChannel[]>('/channels.json'),
    fetchJson<RawStream[]>('/streams.json'),
    fetchJson<RawCategory[]>('/categories.json'),
    fetchJson<RawLogo[]>('/logos.json'),
    fetchJson<RawBlocked[]>('/blocklist.json'),
  ]).then(([channels, streams, categories, logos, blocklist]) => ({
    channels,
    streams,
    categories,
    logos,
    blocklist,
  }));

  cached = result;
  return result;
}