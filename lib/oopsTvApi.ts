import fs from 'fs';
import path from 'path';
import type { Channel, Stream } from '@/types/iptv';

const SPORTS_S1_URL =
  'https://raw.githubusercontent.com/IPTVFlixBD/OopsTv/refs/heads/main/sports-s1.m3u';
const BD_TEST_URL =
  'https://raw.githubusercontent.com/IPTVFlixBD/OopsTv/refs/heads/main/bd-test.m3u';

/**
 * Fetch with timeout helper
 */
async function fetchWithTimeout(url: string, ms = 4000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 3600 },
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Load M3U text with fallback to local file
 */
async function loadM3uWithFallback(
  url: string,
  localFileName: string,
): Promise<string> {
  try {
    const res = await fetchWithTimeout(url, 3000);
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF')) {
        return text;
      }
    }
  } catch {
    // Fall back to bundled data
  }

  const localPath = path.join(process.cwd(), 'data', localFileName);
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf8');
  }

  return '';
}

export async function loadOopsTvSportsS1(): Promise<string> {
  return loadM3uWithFallback(SPORTS_S1_URL, 'oops_sports_s1.m3u');
}

export async function loadOopsTvBdTest(): Promise<string> {
  return loadM3uWithFallback(BD_TEST_URL, 'oops_bd_test.m3u');
}

function extractQuality(name: string): string | null {
  const m = name.match(/\b(1080p|720p|576p|480p|360p|4k|fhd|uhd)\b/i);
  if (!m) return null;
  const q = m[1].toLowerCase();
  if (q === 'fhd') return '1080p';
  if (q === 'uhd') return '4k';
  return q;
}

export function cleanOopsName(name: string): string {
  return name
    .replace(/^[┃|][^┃|]+[┃|]\s*/i, '') // Remove ┃WC┃, ┃BANGLA┃, etc.
    .replace(/^BAN\|\s*/i, '')
    .replace(/^UK\|\s*/i, '')
    .replace(/^ASIA\s*\|\s*/i, '')
    .replace(/\s*\(\s*(1080p|720p|576p|480p|360p|4k|fhd|uhd)\s*\)/gi, '')
    .replace(/(\s*\(\d+\)){2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const KNOWN_BD = new Set([
  'btv',
  'atnbangla',
  'atnnews',
  'anandatv',
  'maasranga',
  'maasrangatv',
  'channeli',
  'independent',
  'independenttv',
  'somoy',
  'somoytv',
  'channel9',
  'satv',
  'jamuna',
  'jamunatv',
  'ekattor',
  'ekattortv',
  'gazitv',
  'deshtv',
  'bijoytv',
  'deeptotv',
  'nagoriktv',
  'banglavision',
  'dbcnews',
  'news24',
  'mycinematv',
  'bangladesh',
  'deshebideshe',
  'asianbd',
]);

const KNOWN_IN = new Set([
  'aakaashbangla',
  'abpananda',
  'zeebangla',
  'colorsbangla',
  'jalshamovies',
  'starjalsha',
  'starsports1',
  'starsports2',
  'sports18',
  'sony8',
  'sonyaath',
  'sonytv',
  'mtv',
  '9xm',
  'b4umusic',
  'mastiii',
  'zoom',
  'hungama',
  'sonic',
  'sonyyay',
  'pogo',
  'disney',
  'nickelodeon',
  'cartoonnetwork',
  'discoverykids',
]);

function inferOopsChannelMeta(
  groupRaw: string,
  nameRaw: string,
  defaultCat?: string,
): { country: string; categories: string[] } {
  const g = (groupRaw || '').toLowerCase();
  const n = nameRaw.toLowerCase();
  const key = normalizeKey(cleanOopsName(nameRaw));

  let country = 'US';
  const categories: string[] = [];

  // 1. Country detection
  if (KNOWN_BD.has(key)) {
    country = 'BD';
  } else if (KNOWN_IN.has(key)) {
    country = 'IN';
  } else if (
    g.includes('uk') ||
    n.includes('sky sports') ||
    n.includes('tnt sports') ||
    n.includes('premier sports')
  ) {
    country = 'GB';
  } else if (g.includes('it') || n.includes('sky sport')) {
    country = 'IT';
  } else if (g.includes('de') || n.includes('fussball')) {
    country = 'DE';
  } else if (
    g.includes('pk') ||
    n.includes('ptv sports') ||
    n.includes('ten sports')
  ) {
    country = 'PK';
  } else if (g.includes('oman')) {
    country = 'OM';
  } else if (
    g.includes('ar') ||
    n.includes('bein sports') ||
    n.includes('al jazeera')
  ) {
    country = 'QA';
  } else if (
    n.includes('makka') ||
    n.includes('al sunnah') ||
    n.includes('saudi')
  ) {
    country = 'SA';
  } else if (n.includes('astro cricket')) {
    country = 'MY';
  } else if (n.includes('fox cricket')) {
    country = 'AU';
  } else if (
    n.includes('star sports') ||
    n.includes('sports 18') ||
    g.includes('india')
  ) {
    country = 'IN';
  } else if (g.includes('bangla')) {
    country = 'BD';
  }

  // 2. Category detection
  if (
    defaultCat === 'sports' ||
    g.includes('sport') ||
    g.includes('cricket') ||
    g.includes('football') ||
    g.includes('world cup') ||
    n.includes('sport') ||
    n.includes('cricket') ||
    n.includes('football') ||
    n.includes('willow')
  ) {
    categories.push('sports');
  }
  if (
    g.includes('kid') ||
    n.includes('kid') ||
    n.includes('junior') ||
    n.includes('pogo') ||
    n.includes('disney') ||
    n.includes('nick')
  ) {
    categories.push('kids', 'animation');
  }
  if (
    g.includes('music') ||
    n.includes('music') ||
    n.includes('9xm') ||
    n.includes('mastiii') ||
    n.includes('zoom')
  ) {
    categories.push('music');
  }
  if (
    n.includes('news') ||
    n.includes('ananda') ||
    n.includes('al jazeera') ||
    n.includes('samachar')
  ) {
    categories.push('news');
  }
  if (
    n.includes('cinema') ||
    n.includes('movie') ||
    n.includes('cineedge') ||
    n.includes('superrix') ||
    n.includes('flash guys') ||
    n.includes('luxel') ||
    n.includes('crimes') ||
    n.includes('true stories')
  ) {
    categories.push('movies', 'entertainment');
  }
  if (
    n.includes('makka') ||
    n.includes('sunnah') ||
    n.includes('quran') ||
    n.includes('islam') ||
    n.includes('deen')
  ) {
    categories.push('religious');
  }
  if (n.includes('delicious')) {
    categories.push('lifestyle');
  }

  if (categories.length === 0) {
    categories.push('general');
  }

  return { country, categories: Array.from(new Set(categories)) };
}

/**
 * Parses OopsTv M3U text and merges into an existing Channel[] array.
 * If a channel matches an existing channel (by normalized name):
 *   attaches the stream without duplicating URLs.
 * If channel is new:
 *   creates a new Channel entry.
 */
export function mergeOopsTvChannels(
  targetChannels: Channel[],
  m3uContent: string,
  defaultCat?: string,
): Channel[] {
  if (!m3uContent) return targetChannels;

  const channelMap = new Map<string, Channel>();
  const existingUrls = new Set<string>();

  for (const ch of targetChannels) {
    channelMap.set(normalizeKey(ch.name), ch);
    for (const s of ch.streams) {
      existingUrls.add(s.url);
    }
  }

  const lines = m3uContent.split(/\r?\n/);
  let currentInf: {
    group: string;
    logo: string | null;
    rawName: string;
  } | null = null;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const comma = line.lastIndexOf(',');
      const rawName = comma !== -1 ? line.substring(comma + 1).trim() : '';

      currentInf = {
        group: groupMatch ? groupMatch[1].trim() : 'General',
        logo: logoMatch ? logoMatch[1].trim() : null,
        rawName,
      };
    } else if (line && !line.startsWith('#') && currentInf) {
      if (!existingUrls.has(line)) {
        existingUrls.add(line);
        const cleanName = cleanOopsName(currentInf.rawName);

        if (cleanName.length >= 2) {
          const key = normalizeKey(cleanName);
          const quality = extractQuality(currentInf.rawName);
          const meta = inferOopsChannelMeta(
            currentInf.group,
            currentInf.rawName,
            defaultCat,
          );

          const stream: Stream = {
            url: line,
            quality,
            label: quality ? quality.toUpperCase() : 'Oops Stream',
            referrer: null,
            user_agent: null,
          };

          const existing = channelMap.get(key);
          if (existing) {
            existing.streams.push(stream);
            for (const cat of meta.categories) {
              if (!existing.categories.includes(cat)) {
                existing.categories.push(cat);
              }
            }
            if (!existing.logo && currentInf.logo) {
              existing.logo = currentInf.logo;
            }
          } else {
            const newChan: Channel = {
              id: `oops-${key}`,
              name: cleanName,
              logo: currentInf.logo,
              country: meta.country,
              categories: meta.categories,
              streams: [stream],
            };
            channelMap.set(key, newChan);
            targetChannels.push(newChan);
          }
        }
      }
      currentInf = null;
    }
  }

  return targetChannels;
}
