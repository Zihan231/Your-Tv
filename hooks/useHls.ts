import { useEffect, useRef, useState } from 'react';

type HlsConstructor = typeof import('hls.js').default;

declare global {
  interface Window {
    Hls?: HlsConstructor;
  }
}

const CDN_URL = 'https://cdn.jsdelivr.net/npm/hls.js@latest/dist/hls.min.js';

/**
 * Loads the hls.js constructor and provides it via state + a ref.
 *
 * Two load paths, attempted in order:
 *  1. A UMD build injected from the jsDelivr CDN, exposed as `window.Hls`.
 *     This is guaranteed new-able in the browser and avoids the ESM class
 *     transpilation problem that the bundled `import('hls.js')` triggers in
 *     some bundlers ("Class constructor Hls cannot be invoked without 'new'").
 *  2. The locally installed package (dynamic import) as a fallback.
 */
export function useHls() {
  const [Hls, setHls] = useState<HlsConstructor | null>(null);
  const loadedRef = useRef<Promise<HlsConstructor | null> | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loadedRef.current) return;

    const constructorOf = (candidate: unknown): HlsConstructor | null => {
      // Must be constructible via `new` (some bundles export a non-callable
      // *module namespace* object when the class is re-exported).
      if (typeof candidate === 'function') {
        try {
          // eslint-disable-next-line no-new
          new (candidate as new () => unknown)();
          return candidate as HlsConstructor;
        } catch {
          /* not itself directly new-able */
        }
      }
      // `{ default: class }` transpiled namespace.
      const nested =
        candidate && typeof candidate === 'object'
          ? (candidate as { default?: unknown }).default
          : null;
      if (typeof nested === 'function') {
        try {
          // eslint-disable-next-line no-new
          new (nested as new () => unknown)();
          return nested as HlsConstructor;
        } catch {
          return null;
        }
      }
      return null;
    };

    const loadFromWindow = (): HlsConstructor | null =>
      constructorOf(window.Hls);

    const loadFromPackage = async (): Promise<HlsConstructor | null> => {
      try {
        const mod = (await import('hls.js')) as unknown;
        const m = mod as {
          Hls?: unknown;
          default?: unknown;
        };
        return constructorOf(m.Hls ?? m.default);
      } catch {
        return null;
      }
    };

    loadedRef.current = new Promise<HlsConstructor | null>((resolve) => {
      const existing = loadFromWindow();
      if (existing) {
        setHls(() => existing);
        resolve(existing);
        return;
      }

      const script = document.createElement('script');
      script.src = CDN_URL;
      script.async = true;

      script.onload = () => {
        const fromWindow = loadFromWindow();
        setHls(() => fromWindow);
        resolve(fromWindow);
      };

      script.onerror = () => {
        loadFromPackage().then((pkg) => {
          setHls(() => pkg);
          resolve(pkg);
        });
      };

      document.head.appendChild(script);
    });
  }, []);

  return Hls;
}