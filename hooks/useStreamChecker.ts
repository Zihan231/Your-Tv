import { useCallback } from 'react';
import type Hls from 'hls.js';
import type { Stream, StreamStatus } from '@/types/iptv';

export interface StreamCheckerApi {
  checkStream: (url: string) => Promise<StreamStatus>;
  checkList: (
    urls: string[],
    onBatch?: (done: number, total: number) => void,
  ) => Promise<void>;
}

export interface HlsRefLike {
  current: typeof Hls | null;
}

const BATCH = 5;
const CHECK_TIMEOUT = 8000;

/**
 * hls.js manifest checker. Runs only in the browser. Never issues HTTP HEAD
 * requests — it loads the manifest with hls.js itself (CORS-safe, matches real
 * playback). Status updates are reported through the provided onStatus
 * callback so the parent can keep React state in sync.
 */
export function useStreamChecker(
  HlsRef: HlsRefLike,
  onStatus: (url: string, status: StreamStatus) => void,
  getStatus: (url: string) => StreamStatus,
): StreamCheckerApi {
  const checkStream = useCallback(
    (url: string): Promise<StreamStatus> => {
      const HlsCtor = HlsRef.current;
      if (!HlsCtor) {
        return Promise.resolve('unknown');
      }

      return new Promise<StreamStatus>((resolve) => {
        const HlsClass = HlsCtor;
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('playsinline', 'true');
        let hls: Hls | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;

        const finish = (status: StreamStatus) => {
          if (timer) clearTimeout(timer);
          try {
            hls?.destroy();
          } catch {
            /* noop */
          }
          video.remove();
          resolve(status);
        };

        if (typeof window !== 'undefined' && HlsClass.isSupported()) {
          const instance = new HlsClass({
            maxBufferLength: 0,
            autoStartLoad: true,
            manifestLoadingTimeOut: CHECK_TIMEOUT,
          });
          hls = instance;
          timer = setTimeout(() => finish('dead'), CHECK_TIMEOUT);

          instance.on(HlsClass.Events.MANIFEST_PARSED, () => finish('alive'));
          instance.on(HlsClass.Events.ERROR, (_e, data) => {
            if (data.fatal) finish('dead');
          });

          try {
            instance.loadSource(url);
            instance.attachMedia(video);
          } catch {
            finish('dead');
          }
        } else if (nativeHlsSupported(video)) {
          video.src = url;
          timer = setTimeout(() => {
            cleanup();
            finish('dead');
          }, CHECK_TIMEOUT);

          const handleLoaded = () => {
            cleanup();
            finish('alive');
          };

          const handleError = () => {
            cleanup();
            finish('dead');
          };

          const cleanup = () => {
            video.removeEventListener('loadedmetadata', handleLoaded);
            video.removeEventListener('error', handleError);
          };

          video.addEventListener('loadedmetadata', handleLoaded);
          video.addEventListener('error', handleError);

          try {
            video.load();
          } catch {
            cleanup();
            finish('dead');
          }
        } else {
          finish('dead');
        }
      });
    },
    [HlsRef],
  );

  const checkList = useCallback(
    async (urls: string[], onBatch?: (done: number, total: number) => void) => {
      const total = urls.length;
      let done = 0;

      for (let i = 0; i < urls.length; i += BATCH) {
        const batch = urls.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (url) => {
            if (getStatus(url) === 'alive' || getStatus(url) === 'dead') return;
            onStatus(url, 'checking');
            const status = await checkStream(url);
            onStatus(url, status);
          }),
        );
        done += batch.length;
        onBatch?.(Math.min(done, total), total);
      }
    },
    [checkStream, getStatus, onStatus],
  );

  return { checkStream, checkList };
}

function nativeHlsSupported(video: HTMLVideoElement) {
  return (
    video.canPlayType('application/vnd.apple.mpegurl') !== '' ||
    video.canPlayType('application/x-mpegURL') !== ''
  );
}