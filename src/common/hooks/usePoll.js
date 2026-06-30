'use client';
import { useEffect, useRef } from 'react';

/**
 * Visibility-aware polling. Calls `fn` every `intervalMs`, but ONLY while the
 * tab is visible — and pauses entirely when the tab is hidden. When the tab
 * regains focus it fires once immediately (so stale prices refresh on return).
 *
 * This keeps upstream calls low (combined with server-side caching) so public
 * APIs like CoinGecko / Yahoo don't rate-limit us. The component using this
 * also unmounts when the user leaves the Discover tab, stopping polls there.
 */
export function usePoll(fn, intervalMs) {
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    const tick = () => { if (typeof document === 'undefined' || !document.hidden) saved.current(); };
    const id = setInterval(tick, intervalMs);
    const onVisible = () => { if (!document.hidden) saved.current(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
}
