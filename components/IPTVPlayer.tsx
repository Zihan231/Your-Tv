'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Hls from 'hls.js';
import CategorySidebar from './CategorySidebar';
import ChannelList from './ChannelList';
import VideoPlayer from './VideoPlayer';
import { useHls } from '@/hooks/useHls';
import { useStreamChecker } from '@/hooks/useStreamChecker';
import { useVirtualChannels } from '@/hooks/useVirtualChannels';
import { FaFolder, FaTv } from 'react-icons/fa';
import type {
  Category,
  Channel,
  PlayerStatus,
  StreamStatus,
  StreamStatusMap,
} from '@/types/iptv';
import styles from './IPTVPlayer.module.css';

const AUTO_CHECK_LIMIT = 30;
const MAX_ATTEMPTS = 3;

interface IPTVPlayerProps {
  initialChannels: Channel[];
  categories: Category[];
  categoryCounts: Map<string, number>;
}

export default function IPTVPlayer({
  initialChannels,
  categories,
  categoryCounts,
}: IPTVPlayerProps) {
const [channels] = useState<Channel[]>(initialChannels);
  const [streamStatus, setStreamStatus] = useState<StreamStatusMap>({});
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedStreamUrl, setSelectedStreamUrl] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState('all'); // SECONDARY
  const [activeCountry, setActiveCountry] = useState('all');   // PRIMARY
  const [searchQuery, setSearchQuery] = useState('');          // TERTIARY
  const [checkProgress, setCheckProgress] = useState({ done: 0, total: 0 });
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');
  const [isMounted, setIsMounted] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [mobileTab, setMobileTab] = useState<'categories' | 'channels'>('categories');

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('favorites_channels');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  const filteredChannels = useVirtualChannels(
    channels,
    activeCountry,
    activeCategory,
    searchQuery,
    streamStatus,
    favorites,
  );

  const hlsClassRef = useRef<typeof Hls | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attemptRef = useRef(0);

  const Hls = useHls();
  hlsClassRef.current = Hls;

  const onStatus = useCallback((url: string, status: StreamStatus) => {
    setStreamStatus((prev) => ({ ...prev, [url]: status }));
  }, []);

  const getStatus = useCallback(
    (url: string): StreamStatus => streamStatus[url] ?? 'unknown',
    [streamStatus],
  );

  const { checkList } = useStreamChecker(hlsClassRef, onStatus, getStatus);

  useEffect(() => {
    return () => {
      const hls = hlsRef.current;
      hls?.destroy();
    };
  }, []);

  /** A channel's best status across all of its streams. */
  const bestStatusOf = useCallback(
    (channel: Channel): StreamStatus => {
      let anyAlive = false;
      let allDead = true;
      let hasKnown = false;

      for (const s of channel.streams) {
        const st = streamStatus[s.url] ?? 'unknown';
        if (st === 'alive') anyAlive = true;
        if (st !== 'alive') allDead = false;
        if (st === 'dead' || st === 'alive') hasKnown = true;
        if (st === 'checking') hasKnown = true;
      }

      if (anyAlive) return 'alive';
      if (hasKnown && allDead === true && channel.streams.length > 0) return 'dead';
      return 'unknown';
    },
    [streamStatus],
  );

  /** Dynamically compute countries from channels list */
  const countries = useMemo(() => {
    if (!isMounted) {
      return [{ code: 'all', name: 'All Countries', flag: '' }];
    }
    const codes = new Set<string>();
    for (const ch of channels) {
      if (ch.country) {
        codes.add(ch.country.toUpperCase());
      }
    }
    const getFlagEmoji = (cCode: string) => {
      const codePoints = cCode
        .toUpperCase()
        .split('')
        .map((char) => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    };
    const list = Array.from(codes).map((code) => {
      let name = code;
      try {
        name = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code;
      } catch {
        // fallback
      }
      return {
        code,
        name,
        flag: getFlagEmoji(code),
      };
    });
    list.sort((a, b) => a.name.localeCompare(b.name));
    return [{ code: 'all', name: 'All Countries', flag: '' }, ...list];
  }, [channels, isMounted]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem('favorites_channels', JSON.stringify(next));
      return next;
    });
  }, []);

  const selectCountry = useCallback((code: string) => {
    setActiveCountry(code);
    setActiveCategory('all');
    setSearchQuery('');
  }, []);

  const selectCategory = useCallback((id: string) => {
    setActiveCategory(id);
    setMobileTab('channels');
  }, []);

  /** Category count filtered by country and excluding dead channels. */
  const perCategoryCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cat of categories) {
      counts.set(cat.id, 0);
    }

    const countryChannels = activeCountry === 'all'
      ? channels
      : channels.filter((ch) => ch.country === activeCountry);

    for (const channel of countryChannels) {
      if (bestStatusOf(channel) === 'dead') continue;
      for (const catId of channel.categories) {
        counts.set(catId, (counts.get(catId) ?? 0) + 1);
      }
    }
    return counts;
  }, [channels, categories, activeCountry, bestStatusOf]);

  const totalCount = useMemo(() => {
    const countryChannels = activeCountry === 'all'
      ? channels
      : channels.filter((ch) => ch.country === activeCountry);

    let total = countryChannels.length;
    for (const channel of countryChannels) {
      if (bestStatusOf(channel) === 'dead') total -= 1;
    }
    return total;
  }, [channels, activeCountry, bestStatusOf]);

  const favoriteCount = useMemo(() => {
    const countryChannels = activeCountry === 'all'
      ? channels
      : channels.filter((ch) => ch.country === activeCountry);
    
    let count = 0;
    for (const ch of countryChannels) {
      if (favorites.includes(ch.id) && bestStatusOf(ch) !== 'dead') {
        count++;
      }
    }
    return count;
  }, [channels, activeCountry, favorites, bestStatusOf]);

  /** Background check the first AUTO_CHECK_LIMIT streams in a set of urls. */
  const checkChannels = useCallback(
    async (list: Channel[]) => {
      const urls = list
        .slice(0, AUTO_CHECK_LIMIT)
        .map((ch) => ch.streams[0]?.url)
        .filter((u): u is string => !!u);
      if (urls.length === 0) return;
      await checkList(urls, (done, total) =>
        setCheckProgress({ done, total }),
      );
    },
    [checkList],
  );

  const selectChannel = useCallback(
    (channel: Channel) => {
      setSelectedChannel(channel);
      const firstUrl = channel.streams[0]?.url ?? null;
      setSelectedStreamUrl(firstUrl);
      attemptRef.current = 1;
      setPlayerStatus('loading');
    },
    [],
  );

  const onPlayerError = useCallback(
    (url: string) => {
      setStreamStatus((prev) => ({ ...prev, [url]: 'dead' }));

      if (!selectedChannel) return;
      const used = new Set([url]);
      let attempt = attemptRef.current + 1;
      let nextUrl: string | null = null;

      while (attempt <= MAX_ATTEMPTS) {
        const candidate = selectedChannel.streams.find(
          (s) => streamStatus[s.url] !== 'dead' && !used.has(s.url),
        );
        if (!candidate) break;
        used.add(candidate.url);
        nextUrl = candidate.url;
        attemptRef.current = attempt;
        break;
      }

      if (nextUrl) {
        setSelectedStreamUrl(nextUrl);
        setPlayerStatus('loading');
      } else {
        setPlayerStatus('error');
      }
      void attempt;
    },
    [selectedChannel, streamStatus],
  );

  const onSwitchStream = useCallback((url: string) => {
    attemptRef.current = 1;
    setSelectedStreamUrl(url);
    setPlayerStatus('loading');
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.mobileHeader}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="YourTv Logo" className={styles.mobileLogo} />
      </div>

      <div className={`${styles.sidebarWrapper} ${
        mobileTab === 'categories' ? styles.showOnMobile : styles.hideOnMobile
      }`}>
        <CategorySidebar
          categories={categories}
          counts={perCategoryCount}
          totalCount={totalCount}
          active={activeCategory}
          onSelect={selectCategory}
          activeCountry={activeCountry}
          onCountrySelect={selectCountry}
          countries={countries}
          favoriteCount={favoriteCount}
        />
      </div>

      <div className={`${styles.listWrapper} ${
        mobileTab === 'channels' ? styles.showOnMobile : styles.hideOnMobile
      }`}>
        <ChannelList
          allChannels={channels}
          statusMap={streamStatus}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          activeCountry={activeCountry}
          setActiveCountry={setActiveCountry}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          checkChannels={() => checkChannels(filteredChannels)}
          onSelect={selectChannel}
          filteredChannels={filteredChannels}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
        />
      </div>

      <div className={styles.playerContainer}>
        <VideoPlayer
          channel={selectedChannel}
          streamStatus={streamStatus}
          selectedStreamUrl={selectedStreamUrl}
          playerStatus={playerStatus}
          hlsClassRef={hlsClassRef}
          hlsRef={hlsRef}
          videoRef={videoRef}
          onError={onPlayerError}
          onSwitchStream={onSwitchStream}
          onStatus={setPlayerStatus}
        />
      </div>

      <div className={styles.mobileTabs}>
        <button
          className={`${styles.mobileTabBtn} ${
            mobileTab === 'categories' ? styles.activeTab : ''
          }`}
          onClick={() => setMobileTab('categories')}
        >
          <FaFolder style={{ marginRight: '6px' }} /> Categories
        </button>
        <button
          className={`${styles.mobileTabBtn} ${
            mobileTab === 'channels' ? styles.activeTab : ''
          }`}
          onClick={() => setMobileTab('channels')}
        >
          <FaTv style={{ marginRight: '6px' }} /> Channels ({filteredChannels.length})
        </button>
      </div>
    </div>
  );
}