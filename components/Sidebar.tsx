'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Channel, StreamStatus } from '@/types/iptv';
import styles from './Sidebar.module.css';

interface SidebarProps {
  allChannels: Channel[];
  statusMap: Record<string, StreamStatus>;
  activeCountry: string;
  setActiveCountry: (code: string) => void;
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  checkChannels: (channels: Channel[]) => Promise<void>;
}

export default function Sidebar({
  allChannels,
  statusMap,
  activeCountry,
  setActiveCountry,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  checkChannels,
}: SidebarProps) {
  // Country dropdown — fixed full width at top
  const [countries, setCountries] = useState<{ code: string; name: string; flag: string }[]>([
    { code: 'all', name: 'All Countries', flag: '🌍' },
    { code: 'US', name: 'United States', flag: '🇺🇸' },
    { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    { code: 'CA', name: 'Canada', flag: '🇨🇦' },
    { code: 'AU', name: 'Australia', flag: '🇦🇺' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: 'CN', name: 'China', flag: '🇨🇳' },
    { code: 'IN', name: 'India', flag: '🇮🇳' },
  ]);

  const [focusCountry, setFocusCountry] = useState<string>('all');

  useEffect(() => {
    // Ensure active country is in the list
    if (!countries.some((c) => c.code === activeCountry)) {
      setCountries((prev) => [...prev, { code: activeCountry, name: getCountryName(activeCountry), flag: getFlagEmoji(activeCountry) }]);
    }
    setFocusCountry(activeCountry);
  }, [activeCountry]);

  function getFlagEmoji(code: string): string {
    const codes: Record<string, string> = {
      US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷',
      JP: '🇯🇵', CN: '🇨🇳', IN: '🇮🇳',
    };
    return codes[code] || '🌍';
  }

  function getCountryName(code: string): string {
    const names: Record<string, string> = {
      US: 'United States', GB: 'United Kingdom', CA: 'Canada', AU: 'Australia',
      DE: 'Germany', FR: 'France', JP: 'Japan', CN: 'China', IN: 'India',
    };
    return names[code] || 'Other';
  }

  useEffect(() => {
    // Trigger checks when country changes (first 100 visible)
    const countryCh = focusCountry === 'all' ? allChannels : allChannels.filter((ch) => ch.country === focusCountry);
    if (countryCh.length > 0) checkChannels(countryCh.slice(0, 100));
  }, [focusCountry, allChannels.length]);

  const handleCountryChange = (code: string) => {
    setFocusCountry(code);
    setActiveCountry(code);
    setActiveCategory('all');
    setSearchQuery('');
    // trigger check on first 100 channels in new country scope
    const countryCh = code === 'all' ? allChannels : allChannels.filter((ch) => ch.country === code);
    checkChannels(countryCh.slice(0, 100));
  };

  // Category counts: reflect country-filtered set
  const categoryCounts = useMemo(() => {
    const countryCh = activeCountry === 'all' ? allChannels : allChannels.filter((ch) => ch.country === activeCountry);
    const catSet = new Set<string>();
    for (const ch of countryCh) {
      for (const cat of ch.categories) catSet.add(cat);
    }
    const counts = new Map<string, number>();
    for (const cat of catSet) {
      let cnt = 0;
      for (const ch of countryCh) {
        if (ch.categories.includes(cat)) cnt++;
      }
      counts.set(cat, cnt);
    }
    return counts;
  }, [allChannels, activeCountry]);

return (
    <aside className={styles.sidebar}>
      {/* Country dropdown — fixed full width at top */}
      <div className={styles.countrySection}>
        <select
          className={styles.countrySelect}
          value={focusCountry === 'all' ? 'all' : focusCountry}
          onChange={(e) => handleCountryChange(e.target.value)}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.divider} />

      <div className={styles.categories}>
        <button
          className={`${styles.item} ${activeCategory === 'all' ? styles.active : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All
          <span className={styles.count}>({allChannels.length})</span>
        </button>
      </div>
    </aside>
  );
}