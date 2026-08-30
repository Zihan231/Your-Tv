import type { Channel, StreamStatus } from '@/types/iptv';

/**
 * Filtering pipeline (STRICT ORDER — do not change):
 *
 *  1. Country filter (PRIMARY):  if activeCountry !== 'all',
 *     keep channels where channel.country === activeCountry.
 *  2. Category filter (SECONDARY): if activeCategory !== 'all',
 *     keep channels where channel.categories.includes(activeCategory).
 *  3. Search filter (TERTIARY): if searchQuery.trim() !== '',
 *     keep channels where channel.name.toLowerCase().includes(searchQuery.toLowerCase()).
 *  4. Sort: alive first, then unknown/checking, then dead;
 *     within each group alphabetical by name.
 *
 * Inputs:
 *   allChannels: Channel[] — full list from server props (never mutated)
 *   activeCountry: string  — country code or 'all'  (applied FIRST)
 *   activeCategory: string — category ID or 'all'   (applied SECOND)
 *   searchQuery: string    — free text               (applied THIRD)
 *   statusMap: Record<string, StreamStatus> — current live check results
 *
 * Output: filteredChannels: Channel[]
 */
export function useVirtualChannels(
  allChannels: Channel[],
  activeCountry: string,
  activeCategory: string,
  searchQuery: string,
  statusMap: Record<string, StreamStatus>,
  favorites: string[],
) {
  // --- Step 1: Country filter (PRIMARY) ---
  let filtered = activeCountry === 'all'
    ? allChannels
    : allChannels.filter((ch) => ch.country === activeCountry);

  // --- Step 2: Category filter (SECONDARY) ---
  if (activeCategory === 'favorites') {
    filtered = filtered.filter((ch) => favorites.includes(ch.id));
  } else if (activeCategory !== 'all') {
    filtered = filtered.filter((ch) => ch.categories.includes(activeCategory));
  }

  // --- Step 3: Search filter (TERTIARY) ---
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((ch) => ch.name.toLowerCase().includes(q));
  }

  // --- Step 4: Sort ---
  const qualityOrder: Record<string, number> = {
    '1080p': 0,
    '720p': 1,
    '480p': 2,
    '360p': 3,
    null: 4,
  };

  filtered.sort((a, b) => {
    const aAlive = a.streams.some((s) => statusMap[s.url] === 'alive');
    const bAlive = b.streams.some((s) => statusMap[s.url] === 'alive');
    if (aAlive && !bAlive) return -1;
    if (!aAlive && bAlive) return 1;
    if (aAlive && bAlive) return 0;

    const aDead = a.streams.every((s) => statusMap[s.url] === 'dead');
    const bDead = b.streams.every((s) => statusMap[s.url] === 'dead');
    if (aDead && !bDead) return 1;
    if (!aDead && bDead) return -1;
    if (aDead && bDead) return 0;

    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    return aName < bName ? -1 : aName > bName ? 1 : 0;
  });

  return filtered;
}