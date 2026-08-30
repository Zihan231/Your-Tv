import { useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { Channel, PlayerStatus, StreamStatusMap } from '@/types/iptv';
import styles from './VideoPlayer.module.css';
import {
  FaVolumeMute,
  FaVolumeDown,
  FaVolumeUp,
  FaCheckCircle,
  FaSpinner,
  FaTimesCircle,
  FaExclamationTriangle,
  FaInfoCircle,
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

  const elemRef =
    (videoRef as React.RefObject<HTMLVideoElement | null>) ?? internalRef;

  const [volumeToast, setVolumeToast] = useState<{
    visible: boolean;
    volume: number;
    muted: boolean;
  }>({ visible: false, volume: 100, muted: false });
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  // when their identity changes (e.g. onError depends on streamStatus).
  // Re-running the effect would destroy the hls.js instance mid-playback and
  // cause a reload loop.
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
          // Autoplay with sound may be blocked by browser policy — retry muted.
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

        // Non-fatal stalls/buffer issues: try to recover before bailing.
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
      // Native HLS (Safari) — fall back to the <video> src directly.
      video.src = stream.url;
      tryPlay();
      reportStatus('playing');
    } else {
      // No HLS support — report error and let the parent try the next stream.
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

  // Keyboard shortcuts (YouTube-like: space for play/pause, m for mute, arrow up/down for volume, f for fullscreen)
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
        return; // Don't trigger shortcuts when typing in search fields or inputs
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'spacebar':
          e.preventDefault();
          if (video.paused) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
          break;
        case 'm':
          video.muted = !video.muted;
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
          if (!document.fullscreenElement) {
            video.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [elemRef, channel, stream]);

  // Handle idle status when nothing is selected.
  useEffect(() => {
    if (!channel) onStatus('idle');
  }, [channel, onStatus]);

  if (!channel || !stream) {
    return (
      <main className={styles.player}>
        <div className={styles.empty}>
          Select a channel to start playing
        </div>
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

      <div className={styles.videoArea}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <video
          ref={elemRef as React.RefObject<HTMLVideoElement>}
          className={styles.video}
          controls
          autoPlay
          playsInline
          muted
        />
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
            <FaExclamationTriangle style={{ color: 'var(--dead)', marginRight: '6px' }} />
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