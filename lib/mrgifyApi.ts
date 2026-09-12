import fs from 'fs';
import path from 'path';

export interface MrgifyInfo {
  owner: string;
  Team: string;
  generated_by: string;
  contact: string;
  support: string;
  version: string;
  github: string;
  note: string;
  disclaimer: string;
  auto_update: boolean;
  update_interval: string;
  total_channels: number;
  last_update: string;
}

export interface MrgifyChannelJson {
  name: string;
  url: string;
}

export interface MrgifyJsonData {
  info?: Partial<MrgifyInfo>;
  channels: MrgifyChannelJson[];
}

export interface MrgifyRawEntry {
  rawName: string;
  cleanName: string;
  url: string;
  quality: string | null;
  group: string;
  logo: string | null;
  tvgId: string | null;
}

const GITHUB_JSON_URL =
  'https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/Channels_data.json';
const GITHUB_M3U_URL =
  'https://raw.githubusercontent.com/abusaeeidx/Mrgify-BDIX-IPTV/main/playlist.m3u';

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
 * Load Mrgify curated JSON data (remote with local fallback)
 */
export async function loadMrgifyJson(): Promise<MrgifyJsonData> {
  try {
    const res = await fetchWithTimeout(GITHUB_JSON_URL, 3000);
    if (res.ok) {
      const data = (await res.json()) as MrgifyJsonData;
      if (Array.isArray(data.channels) && data.channels.length > 0) {
        return data;
      }
    }
  } catch {
    // Fall back to bundled data
  }

  const localPath = path.join(process.cwd(), 'data', 'mrgify_channels.json');
  if (fs.existsSync(localPath)) {
    const content = fs.readFileSync(localPath, 'utf8');
    return JSON.parse(content) as MrgifyJsonData;
  }

  return { channels: [] };
}

/**
 * Load Mrgify M3U text (remote with local fallback)
 */
export async function loadMrgifyM3u(): Promise<string> {
  try {
    const res = await fetchWithTimeout(GITHUB_M3U_URL, 4000);
    if (res.ok) {
      const text = await res.text();
      if (text.includes('#EXTINF')) {
        return text;
      }
    }
  } catch {
    // Fall back to bundled data
  }

  const localPath = path.join(process.cwd(), 'data', 'mrgify_playlist.m3u');
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf8');
  }

  return '';
}
