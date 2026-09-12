import fs from 'fs';
import path from 'path';
import type { Channel, Stream } from '@/types/iptv';

const BINGSTREAM_URL =
  'https://raw.githubusercontent.com/srhady/bingstream/refs/heads/main/playlist.m3u';

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
      next: { revalidate: 1800 },
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Load Bingstream M3U text (remote with local fallback)
 */
export async function loadBingstreamM3u(): Promise<string> {
  try {
    const res = await fetchWithTimeout(BINGSTREAM_URL, 3000);
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF')) {
        return text;
      }
    }
  } catch {
    // Fall back to bundled data
  }

  const localPath = path.join(process.cwd(), 'data', 'bingstream_playlist.m3u');
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf8');
  }

  return '';
}

function inferEventCountry(name: string): string {
  const n = name.toLowerCase();
  if (
    n.includes('premier league') ||
    n.includes('arsenal') ||
    n.includes('sunderland')
  ) {
    return 'GB';
  }
  if (
    n.includes('la liga') ||
    n.includes('real madrid') ||
    n.includes('segunda')
  ) {
    return 'ES';
  }
  if (
    n.includes('serie a') ||
    n.includes('atalanta') ||
    n.includes('cagliari')
  ) {
    return 'IT';
  }
  if (
    n.includes('ligue 1') ||
    n.includes('ligue 2') ||
    n.includes('lyon') ||
    n.includes('le havre')
  ) {
    return 'FR';
  }
  if (
    n.includes('pro league') ||
    n.includes('al-nassr') ||
    n.includes('al khaleej')
  ) {
    return 'SA';
  }
  if (
    n.includes('bundesliga') ||
    n.includes('wolfsburg') ||
    n.includes('st. pauli')
  ) {
    return 'DE';
  }
  if (
    n.includes('eredivisie') ||
    n.includes('cambuur') ||
    n.includes('nijmegen')
  ) {
    return 'NL';
  }
  if (
    n.includes('mlb') ||
    n.includes('us open') ||
    n.includes('ufc') ||
    n.includes('yankees') ||
    n.includes('dodgers') ||
    n.includes('red sox')
  ) {
    return 'US';
  }
  if (n.includes('primeira liga') || n.includes('vitoria')) {
    return 'PT';
  }
  if (
    n.includes('jupiler') ||
    n.includes('leuven') ||
    n.includes('brugge')
  ) {
    return 'BE';
  }
  if (n.includes('ekstraklasa')) {
    return 'PL';
  }
  if (n.includes('hnl') || n.includes('rijeka')) {
    return 'HR';
  }
  if (
    n.includes('primera división') ||
    n.includes('primera nacional') ||
    n.includes('paulista')
  ) {
    return 'AR';
  }
  return 'US';
}

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses the Bingstream live sports events M3U into unified Channel objects,
 * grouping multi-server streams under their respective event match.
 */
export function parseBingstreamChannels(m3uContent: string): Channel[] {
  if (!m3uContent) return [];

  const lines = m3uContent.split(/\r?\n/);
  const events = new Map<string, Channel>();

  let currentInf: {
    logo: string | null;
    rawName: string;
  } | null = null;
  let currentUserAgent: string | null = null;
  let currentReferrer: string | null = null;

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith('#EXTINF:')) {
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const comma = line.lastIndexOf(',');
      const rawName = comma !== -1 ? line.substring(comma + 1).trim() : '';

      currentInf = {
        logo: logoMatch ? logoMatch[1].trim() : null,
        rawName,
      };
      currentUserAgent = null;
      currentReferrer = null;
    } else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
      currentUserAgent = line
        .substring('#EXTVLCOPT:http-user-agent='.length)
        .trim();
    } else if (line.startsWith('#EXTVLCOPT:http-referrer=')) {
      currentReferrer = line
        .substring('#EXTVLCOPT:http-referrer='.length)
        .trim();
    } else if (line && !line.startsWith('#') && currentInf) {
      const serverMatch = currentInf.rawName.match(/\[Server\s*(\d+)\]/i);
      const serverLabel = serverMatch ? `Server ${serverMatch[1]}` : null;
      const cleanTitle = currentInf.rawName
        .replace(/\s*\[Server\s*\d+\]/i, '')
        .trim();

      if (cleanTitle.length >= 2) {
        const quality = line.includes('-hd')
          ? '720p'
          : line.includes('-fhd')
          ? '1080p'
          : null;

        const stream: Stream = {
          url: line,
          quality,
          label: serverLabel || 'Live Stream',
          referrer: currentReferrer,
          user_agent: currentUserAgent,
        };

        const key = normalizeKey(cleanTitle);
        const existing = events.get(key);

        if (!existing) {
          events.set(key, {
            id: `bing-${key}`,
            name: cleanTitle,
            logo: currentInf.logo,
            country: inferEventCountry(cleanTitle),
            categories: ['sports', 'live-events'],
            streams: [stream],
          });
        } else {
          if (!existing.streams.some((s) => s.url === stream.url)) {
            existing.streams.push(stream);
          }
          if (!existing.logo && currentInf.logo) {
            existing.logo = currentInf.logo;
          }
        }
      }
      currentInf = null;
    }
  }

  return Array.from(events.values());
}
