'use client';
import { useCallback, useEffect, useState } from 'react';

/**
 * Minimal data-fetching hook. Re-runs when `deps` change or refetch() is called.
 * Returns { data, loading, error, refetch }.
 */
export function useApi(fn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn();
      setData(res?.data !== undefined ? res.data : res);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { data, loading, error, refetch: run };
}
