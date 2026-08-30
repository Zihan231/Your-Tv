import { useEffect, useState } from 'react';
import type { Channel, StreamStatus } from '@/types/iptv';
import styles from './ChannelList.module.css';
import { FaStar, FaTv } from 'react-icons/fa';

interface ChannelListProps {
  allChannels: Channel[];
  statusMap: Record<string, StreamStatus>;
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  activeCountry: string;
  setActiveCountry: (code: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  checkChannels: (channels: Channel[]) => Promise<void>;
  onSelect: (channel: Channel) => void;
  filteredChannels: Channel[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

export default function ChannelList({
  allChannels,
  statusMap,
  activeCategory,
  setActiveCategory,
  activeCountry,
  setActiveCountry,
  searchQuery,
  setSearchQuery,
  checkChannels,
  onSelect,
  filteredChannels,
  favorites,
  onToggleFavorite,
}: ChannelListProps) {
  const [visibleCount, setVisibleCount] = useState(100);

  // Reset pagination limit when filters change
  useEffect(() => {
    setVisibleCount(100);
  }, [activeCountry, activeCategory, searchQuery]);

  // Trigger checks when country or category changes (first 30 visible on desktop, first 5 on mobile)
  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const limit = isMobile ? 5 : 30;
    const ch = filteredChannels.slice(0, limit);
    if (ch.length > 0) checkChannels(ch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCountry, activeCategory]);

  const bestStatusOf = (
    ch: Channel,
  ): 'alive' | 'dead' | 'unknown' => {
    let anyAlive = false;
    let allDead = true;
    let hasKnown = false;
    for (const s of ch.streams) {
      const st = statusMap[s.url] ?? 'unknown';
      if (st === 'alive') anyAlive = true;
      if (st !== 'alive') allDead = false;
      if (st === 'dead' || st === 'alive') hasKnown = true;
      if (st === 'checking') hasKnown = true;
    }
    if (anyAlive) return 'alive';
    if (hasKnown && allDead && ch.streams.length > 0) return 'dead';
    return 'unknown';
  };

  const quality =
    allChannels.length > 0
      ? allChannels[0]?.streams
          .map((s) => s.quality)
          .filter((q): q is string => q !== null)
          .sort((a, b) => (b as string).localeCompare(a as string))[0] ?? ''
      : '';

  return (
    <section className={styles.list}>
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          type="text"
          placeholder="Search channels..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className={styles.checkBtn} onClick={() => checkChannels(filteredChannels)}>
          Check Visible
        </button>
      </div>

      {statusMap && allChannels.length > 0 && (
        <div className={styles.scroll}>
          {filteredChannels.slice(0, visibleCount).map((ch) => {
            const status = bestStatusOf(ch);
            const dot =
              status === 'alive'
                ? styles.dotAlive
                : status === 'dead'
                  ? styles.dotDead
                  : styles.dotUnknown;
            const isFav = favorites.includes(ch.id);

            return (
              <div
                key={ch.id}
                className={styles.row}
                onClick={() => onSelect(ch)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelect(ch);
                  }
                }}
              >
                <span className={dot} />
                {ch.logo ? (
                  <img
                    src={ch.logo}
                    alt=""
                    width={32}
                    height={32}
                    className={styles.logo}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.fallback}>
                    <FaTv className={styles.fallbackIcon} />
                  </span>
                )}
                <span className={styles.info}>
                  <span className={styles.name}>{ch.name}</span>
                  <span className={styles.meta}>
                    {ch.country && <span>{ch.country}</span>}
                    {quality && <span className={styles.badge}>{quality}</span>}
                  </span>
                </span>
                
                <button
                  className={`${styles.favoriteBtn} ${isFav ? styles.favoriteActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(ch.id);
                  }}
                  title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <FaStar />
                </button>
              </div>
            );
          })}
          {visibleCount < filteredChannels.length && (
            <button
              className={styles.loadMoreBtn}
              onClick={() => setVisibleCount((prev) => prev + 100)}
            >
              Load More (+100)
            </button>
          )}
          {filteredChannels.length === 0 && (
            <div className={styles.empty}>No channels found</div>
          )}
        </div>
      )}
    </section>
  );
}