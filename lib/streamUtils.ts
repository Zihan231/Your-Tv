import type {
  Channel,
  RawChannel,
  RawLogo,
  RawStream,
  Stream,
} from '@/types/iptv';
import type { MrgifyJsonData } from './mrgifyApi';

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

// Known logos map for popular channels where M3U or iptv-org logos might be missing
const KNOWN_LOGOS: Record<string, string> = {
  tsports: 'https://i.imgur.com/2JzlorD.png',
  starjalsha: 'https://i.imgur.com/vHqB1P9.png',
  starjalshahd: 'https://i.imgur.com/vHqB1P9.png',
  sonyaath: 'https://i.imgur.com/2U5C2jW.png',
  sony8: 'https://i.imgur.com/2U5C2jW.png',
  doraemon:
    'https://upload.wikimedia.org/wikipedia/commons/0/01/Doraemon_Merch_EN_Logo.svg',
  motupatlu: 'https://upload.wikimedia.org/wikipedia/en/e/e0/Motu_Patlu.png',
  gopalbhar: 'https://upload.wikimedia.org/wikipedia/en/8/87/Gopal_Bhar_character.jpg',
  hindimovies: 'https://i.imgur.com/9n9b0Fp.png',
  southmovies: 'https://i.imgur.com/9n9b0Fp.png',
  rajdhanitv: 'https://i.imgur.com/MBm2gPz.jpeg',
  greentv: 'https://i.imgur.com/YDQT4yw.png',
  deshitv: 'https://i.imgur.com/PzqzgMm.png',
  atnmusic:
    'https://www.jagobd.com/wp-content/uploads/2015/12/atnmusic.jpg?x50681',
  willow: 'https://i.imgur.com/v7nSm7M.png',
  durontotv: 'https://i.imgur.com/rN5uU6N.png',
};

export function extractQuality(name: string): string | null {
  const m = name.match(/\b(1080p|720p|576p|480p|360p|4k|fhd)\b/i);
  return m ? m[1].toLowerCase() : null;
}

export function cleanChannelName(name: string): string {
  return name
    .replace(/^\[BD\]\s*/i, '')
    .replace(/\s*\(\s*(1080p|720p|576p|480p|360p|4k|fhd)\s*\)/gi, '')
    .replace(/(\s*\(\d+\)){2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface ParsedM3uEntry {
  rawName: string;
  url: string;
  logo: string | null;
  group: string;
}

function parseM3uText(m3uContent: string): Map<string, ParsedM3uEntry> {
  const map = new Map<string, ParsedM3uEntry>();
  if (!m3uContent) return map;

  const lines = m3uContent.split(/\r?\n/);
  let current: { logo: string | null; group: string; rawName: string } | null = null;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const comma = line.lastIndexOf(',');
      const rawName = comma !== -1 ? line.substring(comma + 1).trim() : '';

      current = {
        logo: logoMatch ? logoMatch[1] : null,
        group: groupMatch ? groupMatch[1] : 'General',
        rawName,
      };
    } else if (line && !line.startsWith('#') && current) {
      if (!map.has(line)) {
        map.set(line, {
          rawName: current.rawName,
          url: line,
          logo: current.logo,
          group: current.group,
        });
      }
      current = null;
    }
  }

  return map;
}

// Authentic Bangladeshi channels
const KNOWN_BD_CHANNELS = new Set([
  'greentv', 'deshitv', 'mytv', 'atnmusic', 'boishakhitv', 'channels',
  'maasrangatv', 'maasrangahd', 'rtv', 'gazitv', 'rajdhanitv', 'rajdhanicable',
  'durontotv', 'tsports', 'tsportshd', 'tsportslive01', 'ntv', 'nexustv',
  'ekusheytv', 'atnnews', 'anandatv', 'btvchattogram', 'btvnews', 'btv',
  'ekattortv', 'ekhontv', 'ekusheetv', 'gseriesdrama', 'deshtv', 'bijoytv',
  'satv', 'mohonatv', 'rongeentv', 'jamunatv', 'somoytv', 'channeli',
  'banglavision', 'dbcnews', 'independenttv', 'news24bd', 'deeptotv',
  'nagoriktv', 'asianbd', 'matribhumitv', 'musicbangla', 'deshebideshe',
  'toffeetv', 'drama24', 'atnbangla'
]);

// Authentic Indian channels
const KNOWN_IN_CHANNELS = new Set([
  'starjalsha', 'starjalshahd', 'sony8', 'sonyaath', 'sonytv', 'sonytvhd',
  'sonysports2', 'sonysports2hd', 'sonysports5', 'sonysports5hd', 'starsports1',
  'starsports1hindi', 'starsports1hindihd', 'bhojpuricinema', 'shemaroobollywood',
  'actionbollywoodmovies', 'hindimovies', 'southmovies', 'hindihitshd',
  'motupatlu', 'gopalbhar', 'doraemon', 'zeebangla', 'ctvnakdplus',
  'pardesitv', 'republicbangla', 'tv9bangla', 'zee24ghanta', 'kolkatatv',
  'sangeetbangla', 'goldmines', '9xtashan', '9xjalwa', 'musicindia',
  'ddsports', 'khushboo', 'cricketgold', 'sonymax', 'sonysab', 'colorsbangla',
  'colorshd', 'starnews', 'network10'
]);

/**
 * Accurately determines country and genre categories for a channel
 * instead of defaulting everything to 'BD' or 'BDIX'.
 */
function inferChannelMeta(
  group: string,
  nameRaw: string,
  iptvMatch?: { country?: string; categories?: string[] },
): { country: string; categories: string[] } {
  const clean = cleanChannelName(nameRaw);
  const key = normalizeKey(clean);
  const g = (group || '').toLowerCase();
  const n = clean.toLowerCase();

  let country = 'US';
  const categories: string[] = [];

  // --- 1. Accurate Country Detection ---
  if (KNOWN_BD_CHANNELS.has(key)) {
    country = 'BD';
  } else if (KNOWN_IN_CHANNELS.has(key)) {
    country = 'IN';
  } else if (key === 'dw' || key === 'dwnews') {
    country = 'DE';
  } else if (
    key === 'radiobbc' ||
    key === 'bbcnews' ||
    key === 'horsecountry'
  ) {
    country = 'GB';
  } else if (key === 'tracesport') {
    country = 'FR';
  } else if (key === 'musictv') {
    country = 'AT';
  } else if (key === 'tntmusic') {
    country = 'RU';
  } else if (
    key === 'asports' ||
    key === 'ptvsports' ||
    key === 'geoent' ||
    key.includes('hum') ||
    key.includes('peacetv')
  ) {
    country = 'PK';
  } else if (key === 'omansportstv') {
    country = 'OM';
  } else if (
    key.includes('beinsport') ||
    key === 'mtrspt' ||
    key === 'willow' ||
    key === 'animalplanethd' ||
    key === 'digitalfashion' ||
    key === 'a30music' ||
    key.includes('cartoon') ||
    key.includes('disney') ||
    key.includes('nick')
  ) {
    country = 'US';
  } else if (g.includes('bangla') || g.includes('bangladesh')) {
    country = 'BD';
  } else if (
    g.includes('indian bangla') ||
    g.includes('hindi') ||
    g.includes('india')
  ) {
    country = 'IN';
  } else if (g.includes('urdhu')) {
    country = 'PK';
  } else if (g.includes('english')) {
    country = 'US';
  } else if (iptvMatch?.country && iptvMatch.country.length === 2) {
    country = iptvMatch.country.toUpperCase();
  } else {
    country = 'BD';
  }

  // --- 2. Accurate Genre Category Detection ---
  if (
    g.includes('sport') ||
    g.includes('cricket') ||
    g.includes('football') ||
    n.includes('sport') ||
    n.includes('cricket') ||
    n.includes('football') ||
    n.includes('willow') ||
    n.includes('fifa') ||
    n.includes('golf') ||
    n.includes('archery') ||
    n.includes('horse & country')
  ) {
    categories.push('sports');
  }
  if (
    g.includes('news') ||
    n.includes('news') ||
    n.includes('samachar') ||
    n.includes('khabor')
  ) {
    categories.push('news');
  }
  if (
    g.includes('kid') ||
    g.includes('cartoon') ||
    n.includes('cartoon') ||
    n.includes('doraemon') ||
    n.includes('motu patlu') ||
    n.includes('gopal bhar') ||
    n.includes('duronto') ||
    n.includes('disney') ||
    n.includes('nick')
  ) {
    categories.push('kids', 'animation');
  }
  if (
    g.includes('music') ||
    g.includes('radio') ||
    n.includes('music') ||
    n.includes('sangeet') ||
    n.includes('radio') ||
    n.includes('fm')
  ) {
    categories.push('music');
  }
  if (
    g.includes('movie') ||
    g.includes('drama') ||
    n.includes('movie') ||
    n.includes('cinema') ||
    n.includes('drama') ||
    n.includes('bollywood') ||
    n.includes('goldmines')
  ) {
    categories.push('movies', 'entertainment');
  }
  if (
    g.includes('relig') ||
    n.includes('deen') ||
    n.includes('taqbeer') ||
    n.includes('eman') ||
    n.includes('islam') ||
    n.includes('peace tv')
  ) {
    categories.push('religious');
  }
  if (g.includes('weather') || n.includes('weather')) {
    categories.push('weather');
  }
  if (
    g.includes('infotainment') ||
    n.includes('animal planet') ||
    n.includes('discovery') ||
    n.includes('docu')
  ) {
    categories.push('documentary');
  }
  if (n.includes('fashion')) {
    categories.push('lifestyle');
  }

  // Fallback to iptv-org categories or general
  if (categories.length === 0) {
    if (iptvMatch?.categories && iptvMatch.categories.length > 0) {
      categories.push(...iptvMatch.categories);
    } else {
      categories.push('general');
    }
  }

  return { country, categories: Array.from(new Set(categories)) };
}

/**
 * Merges Mrgify channels into existing base channels:
 * - Channels are properly categorized by genre (sports, news, kids, movies, etc.)
 * - Non-BD channels are accurately mapped to their real countries (IN, US, GB, DE, etc.)
 * - Matched existing channels get high-speed streams prepended without changing country.
 */
export function mergeMrgifyChannels(
  baseChannels: Channel[],
  mrgifyJson: MrgifyJsonData,
  m3uContent: string,
  rawLogos: RawLogo[] = [],
): Channel[] {
  const merged: Channel[] = baseChannels.map((ch) => ({
    ...ch,
    categories: [...ch.categories],
    streams: [...ch.streams],
  }));

  const logoByChannelId = new Map<string, string>();
  for (const l of rawLogos) {
    if (l.channel && l.url && !logoByChannelId.has(l.channel.toLowerCase())) {
      logoByChannelId.set(l.channel.toLowerCase(), l.url);
    }
  }

  const channelByName = new Map<string, Channel>();
  const existingUrls = new Set<string>();

  for (const ch of merged) {
    channelByName.set(normalizeKey(ch.name), ch);
    for (const s of ch.streams) {
      existingUrls.add(s.url);
    }
  }

  const m3uMap = parseM3uText(m3uContent);
  const processedUrls = new Set<string>();

  const addStream = (
    nameRaw: string,
    url: string,
    m3uEntry?: ParsedM3uEntry,
  ) => {
    if (!url || processedUrls.has(url) || existingUrls.has(url)) return;
    processedUrls.add(url);
    existingUrls.add(url);

    const cleanName = cleanChannelName(nameRaw);
    if (!cleanName || cleanName.length < 2) return;

    const key = normalizeKey(cleanName);
    const existing = channelByName.get(key);

    const quality =
      extractQuality(nameRaw) ||
      (m3uEntry ? extractQuality(m3uEntry.rawName) : null);
    const group = m3uEntry ? m3uEntry.group : 'General';
    const meta = inferChannelMeta(group, cleanName, existing);

    const m3uLogo = m3uEntry?.logo || null;
    const knownLogo = KNOWN_LOGOS[key] || null;
    const iptvLogo =
      logoByChannelId.get(key) ||
      logoByChannelId.get(`${key}.bd`) ||
      logoByChannelId.get(`${key}.in`) ||
      null;
    const resolvedLogo = knownLogo || m3uLogo || iptvLogo;

    const streamObj: Stream = {
      url,
      quality,
      label: quality ? `Quality ${quality.toUpperCase()}` : 'Live Stream',
      referrer: null,
      user_agent: null,
    };

    if (existing) {
      existing.streams.unshift(streamObj);
      // Merge in any newly discovered genre categories
      for (const cat of meta.categories) {
        if (!existing.categories.includes(cat)) {
          existing.categories.push(cat);
        }
      }
      if (!existing.logo && resolvedLogo) {
        existing.logo = resolvedLogo;
      }
    } else {
      const newChan: Channel = {
        id: `mrgify-${key}`,
        name: cleanName,
        categories: meta.categories,
        country: meta.country,
        logo: resolvedLogo,
        streams: [streamObj],
      };
      channelByName.set(key, newChan);
      merged.push(newChan);
    }
  };

  // 1. Process the curated JSON channels first
  if (mrgifyJson && Array.isArray(mrgifyJson.channels)) {
    for (const c of mrgifyJson.channels) {
      if (c && c.url) {
        addStream(c.name, c.url, m3uMap.get(c.url));
      }
    }
  }

  // 2. Process all remaining unique entries from M3U
  for (const [url, entry] of m3uMap.entries()) {
    addStream(entry.rawName, url, entry);
  }

  return merged;
}