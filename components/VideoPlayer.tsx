import { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { Channel, PlayerStatus, StreamStatusMap } from '@/types/iptv';
import styles from './VideoPlayer.module.css';
import {
  FaPlay,
  FaPause,
  FaVolumeMute,
  FaVolumeDown,
  FaVolumeUp,
  FaCheckCircle,
  FaSpinner,
  FaTimesCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaExpand,
  FaCompress,
} from 'react-icons/fa';

interface HlsClassRefLike {
  current: typeof Hls | null;
}

interface HlsInstanceRefLike {
  current: Hls | null;
}

interface VideoPlayerProps {
  channel: Channel | null;
  streamStatus: StreamStatusMap;
  selectedStreamUrl: string | null;
  playerStatus: PlayerStatus;
  hlsClassRef: HlsClassRefLike;
  hlsRef: HlsInstanceRefLike;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onError: (url: string) => void;
  onSwitchStream: (url: string) => void;
  onStatus: (status: PlayerStatus) => void;
}

export default function VideoPlayer({
  channel,
  streamStatus,
  selectedStreamUrl,
  playerStatus,
  hlsClassRef,
  hlsRef,
  videoRef,
  onError,
  onSwitchStream,
  onStatus,
}: VideoPlayerProps) {
  const stream = channel?.streams.find((s) => s.url === selectedStreamUrl) ?? null;
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const videoAreaRef = useRef<HTMLDivElement | null>(null);

  const elemRef =
    (videoRef as React.RefObject<HTMLVideoElement | null>) ?? internalRef;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [volumeToast, setVolumeToast] = useState<{
    visible: boolean;
    volume: number;
    muted: boolean;
  }>({ visible: false, volume: 100, muted: false });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inactivity auto-hide timer (3.5 seconds)
  const resetIdleTimer = useCallback(() => {
    setShowControls(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      const video = elemRef.current;
      // Only auto-hide if currently playing and not paused/buffering
      if (video && !video.paused && playerStatus !== 'error') {
        setShowControls(false);
      }
    }, 3500);
  }, [elemRef, playerStatus]);

  // Handle Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      resetIdleTimer();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [resetIdleTimer]);

  const toggleFullscreen = useCallback(() => {
    const container = videoAreaRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {
        // Fallback to video tag if container fails
        elemRef.current?.requestFullscreen().catch(() => {});
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, [elemRef]);

  // Synchronize playback & volume state with video element
  useEffect(() => {
    const video = elemRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      resetIdleTimer();
    };

    const handlePause = () => {
      setIsPlaying(false);
      setShowControls(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };

    const handleVolume = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('playing', handlePlay);
    video.addEventListener('volumechange', handleVolume);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('playing', handlePlay);
      video.removeEventListener('volumechange', handleVolume);
    };
  }, [elemRef, resetIdleTimer]);

  const togglePlay = useCallback(() => {
    const video = elemRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [elemRef]);

  const toggleMute = useCallback(() => {
    const video = elemRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, [elemRef]);

  const handleVolumeSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = elemRef.current;
      if (!video) return;
      const newVol = parseFloat(e.target.value);
      video.volume = newVol;
      if (newVol > 0 && video.muted) {
        video.muted = false;
      }
      resetIdleTimer();
    },
    [elemRef, resetIdleTimer],
  );

  // Handle volume change HUD toast
  useEffect(() => {
    const video = elemRef.current;
    if (!video) return;

    let initial = true;

    const handleVolumeChange = () => {
      if (initial) {
        initial = false;
        return;
      }

      setVolumeToast({
        visible: true,
        volume: Math.round(video.volume * 100),
        muted: video.muted,
      });

      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => {
        setVolumeToast((prev) => ({ ...prev, visible: false }));
      }, 1200);
    };

    video.addEventListener('volumechange', handleVolumeChange);
    return () => {
      video.removeEventListener('volumechange', handleVolumeChange);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [elemRef, channel, stream]);

  // Keep the latest callbacks in refs so the playback effect doesn't re-run
  const onStatusRef = useRef(onStatus);
  const onErrorRef = useRef(onError);
  onStatusRef.current = onStatus;
  onErrorRef.current = onError;

  // Rebuild hls.js instance whenever the selected stream changes.
  useEffect(() => {
    if (!stream || !elemRef.current) return;

    const video = elemRef.current;
    const reportStatus = (s: PlayerStatus) => onStatusRef.current(s);
    const reportError = (u: string) => onErrorRef.current(u);
    let disposed = false;
    let errorNav = false;

    const HlsCtor = hlsClassRef.current;

    const tryPlay = () => {
      const p = video.play();
      if (p) {
        p.then(() => {
          video.muted = false;
        }).catch(() => {
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    };

    if (HlsCtor && HlsCtor.isSupported()) {
      hlsRef.current?.destroy();
      const hls = new HlsCtor({
        autoStartLoad: true,
        liveSyncDurationCount: 3,
        backBufferLength: 0,
        maxBufferLength: 30,
        maxBufferHole: 0.5,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;

      let played = false;
      let recovered = false;

      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        if (disposed) return;
        reportStatus('playing');
        if (!played) {
          played = true;
          tryPlay();
        }
      });

      const handleError = (data: { fatal?: boolean; details?: string }) => {
        if (data.fatal) {
          if (!errorNav) {
            errorNav = true;
            reportStatus('error');
            hls.destroy();
            hlsRef.current = null;
            reportError(stream.url);
          }
          return;
        }

        const details = data.details ?? '';
        if (
          (details === HlsCtor.ErrorDetails.BUFFER_STALLED_ERROR ||
            details === HlsCtor.ErrorDetails.BUFFER_APPEND_ERROR ||
            details === HlsCtor.ErrorDetails.FRAG_LOAD_ERROR ||
            details === HlsCtor.ErrorDetails.LEVEL_LOAD_ERROR) &&
          !recovered
        ) {
          recovered = true;
          reportStatus('loading');
          hls.startLoad();
        }
      };

      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (disposed) return;
        handleError(data);
      });

      try {
        reportStatus('loading');
        hls.loadSource(stream.url);
        hls.attachMedia(video);
      } catch {
        if (!errorNav) {
          errorNav = true;
          reportStatus('error');
          reportError(stream.url);
        }
      }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = stream.url;
      tryPlay();
      reportStatus('playing');
    } else {
      reportStatus('error');
      reportError(stream.url);
    }

    return () => {
      disposed = true;
      const instance = hlsRef.current;
      if (instance) {
        instance.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream, elemRef, hlsRef, hlsClassRef]);

  // Keyboard shortcuts
  useEffect(() => {
    const video = elemRef.current;
    if (!video) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      resetIdleTimer();

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'spacebar':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          toggleMute();
          break;
        case 'arrowup':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.05);
          if (video.volume > 0) {
            video.muted = false;
          }
          break;
        case 'arrowdown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.05);
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [elemRef, togglePlay, toggleMute, toggleFullscreen, resetIdleTimer]);

  // Clean up idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  // Handle idle status when nothing is selected.
  useEffect(() => {
    if (!channel) onStatus('idle');
  }, [channel, onStatus]);

  if (!channel || !stream) {
    return (
      <main className={styles.player}>
        <div className={styles.empty}>Select a channel to start playing</div>
      </main>
    );
  }

  const needsHeaders = stream.referrer || stream.user_agent;
  const statusText =
    playerStatus === 'playing' ? (
      <>
        <FaCheckCircle style={{ color: 'var(--alive)', marginRight: '6px' }} />
        Stream loaded
      </>
    ) : playerStatus === 'loading' ? (
      <>
        <FaSpinner className={styles.spin} style={{ marginRight: '6px' }} />
        Loading stream...
      </>
    ) : playerStatus === 'error' ? (
      <>
        <FaTimesCircle style={{ color: 'var(--dead)', marginRight: '6px' }} />
        Failed — trying next...
      </>
    ) : (
      'Idle'
    );

  const isIdleHidden = !showControls && isPlaying && playerStatus !== 'error';

  return (
    <main className={styles.player}>
      <div className={styles.info}>
        <h1 className={styles.title}>{channel.name}</h1>
        <span className={styles.country}>{channel.country}</span>
        <div className={styles.tags}>
          {channel.categories.map((cat) => (
            <span key={cat} className={styles.tag}>
              {cat}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={videoAreaRef}
        className={`${styles.videoArea} ${
          isFullscreen ? styles.isFullscreen : ''
        } ${isIdleHidden ? styles.hideCursor : ''}`}
        onMouseMove={resetIdleTimer}
        onMouseDown={resetIdleTimer}
        onTouchStart={resetIdleTimer}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <video
          ref={elemRef as React.RefObject<HTMLVideoElement>}
          className={styles.video}
          autoPlay
          playsInline
          muted
        />

        {/* Custom Overlay Controls */}
        <div
          className={`${styles.overlay} ${
            isIdleHidden ? styles.overlayHidden : styles.overlayVisible
          }`}
        >
          {/* Top Bar (Channel title in fullscreen) */}
          <div className={styles.topOverlay}>
            <div className={styles.topTitleGroup}>
              <h2 className={styles.topTitle}>{channel.name}</h2>
              <span className={styles.country}>{channel.country}</span>
            </div>
            {playerStatus === 'loading' && (
              <div className={styles.status}>
                <FaSpinner className={styles.spin} style={{ marginRight: '6px' }} />
                Connecting...
              </div>
            )}
          </div>

          {/* Center clickable area */}
          <div
            className={styles.centerArea}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
          >
            {playerStatus === 'loading' && (
              <FaSpinner className={`${styles.centerSpinner} ${styles.spin}`} />
            )}
            {!isPlaying && playerStatus !== 'loading' && playerStatus !== 'error' && (
              <div className={styles.centerPlayIcon}>
                <FaPlay style={{ marginLeft: '4px' }} />
              </div>
            )}
          </div>

          {/* Bottom Control Bar */}
          <div className={styles.bottomBar}>
            <div className={styles.bottomLeft}>
              <button
                className={styles.controlBtn}
                onClick={togglePlay}
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <FaPause /> : <FaPlay />}
              </button>

              <div className={styles.volumeWrapper}>
                <button
                  className={styles.controlBtn}
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <FaVolumeMute />
                  ) : volume < 0.5 ? (
                    <FaVolumeDown />
                  ) : (
                    <FaVolumeUp />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeSlider}
                  className={styles.volumeSlider}
                  title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  aria-label="Volume Slider"
                />
              </div>

              <div className={styles.livePill}>
                <span
                  className={`${styles.liveDot} ${
                    playerStatus === 'error'
                      ? styles.liveDotError
                      : playerStatus === 'loading'
                      ? styles.liveDotLoading
                      : ''
                  }`}
                />
                <span className={styles.liveText}>
                  {playerStatus === 'error' ? 'OFFLINE' : 'LIVE'}
                </span>
              </div>
            </div>

            <div className={styles.bottomRight}>
              {channel.streams.length > 1 && (
                <select
                  className={styles.overlaySelect}
                  value={selectedStreamUrl ?? ''}
                  onChange={(e) => onSwitchStream(e.target.value)}
                  title="Stream Quality"
                  aria-label="Stream Quality"
                >
                  {channel.streams.map((s) => (
                    <option key={s.url} value={s.url}>
                      {s.quality || 'auto'}
                      {s.label ? ` · ${s.label}` : ''}
                    </option>
                  ))}
                </select>
              )}

              <button
                className={styles.controlBtn}
                onClick={toggleFullscreen}
                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
          </div>
        </div>

        {/* Volume Change HUD Toast */}
        {volumeToast.visible && (
          <div className={styles.volumeToast}>
            <span className={styles.volumeIcon}>
              {volumeToast.muted || volumeToast.volume === 0 ? (
                <FaVolumeMute />
              ) : volumeToast.volume < 50 ? (
                <FaVolumeDown />
              ) : (
                <FaVolumeUp />
              )}
            </span>
            <span className={styles.volumeText}>
              {volumeToast.muted ? 'Muted' : `${volumeToast.volume}%`}
            </span>
          </div>
        )}

        {playerStatus === 'error' && (
          <div className={styles.banner}>
            <FaExclamationTriangle
              style={{ color: 'var(--dead)', marginRight: '6px' }}
            />
            Stream failed — try another
          </div>
        )}
      </div>

      {channel.streams.length > 1 && (
        <div className={styles.controls}>
          <label className={styles.label}>Quality</label>
          <select
            className={styles.select}
            value={selectedStreamUrl ?? ''}
            onChange={(e) => onSwitchStream(e.target.value)}
          >
            {channel.streams.map((s) => (
              <option key={s.url} value={s.url}>
                {s.quality || 'auto'}
                {s.label ? ` · ${s.label}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {needsHeaders && (
        <div className={styles.note}>
          <FaInfoCircle style={{ color: '#fbbf24', marginRight: '6px' }} />
          May need special headers — this stream may not play in a browser.
        </div>
      )}

      <div className={styles.status}>{statusText}</div>
    </main>
  );
}