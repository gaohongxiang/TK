import { useCallback, useEffect, useRef, useState } from 'react';

const REMOTE_STALE_AUTO_REFRESH_DELAY_MS = 60_000;

type UseStaleAutoRefreshOptions = {
  canRefresh: boolean;
  delayMs?: number;
  onRefresh: () => void | Promise<unknown>;
  onRefreshError?: (error: unknown) => void;
};

function useStaleAutoRefresh({
  canRefresh,
  delayMs = REMOTE_STALE_AUTO_REFRESH_DELAY_MS,
  onRefresh,
  onRefreshError
}: UseStaleAutoRefreshOptions) {
  const [stale, setStale] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const tickerRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const deadlineRef = useRef(0);
  const canRefreshRef = useRef(canRefresh);
  const onRefreshRef = useRef(onRefresh);
  const onRefreshErrorRef = useRef(onRefreshError);

  useEffect(() => {
    canRefreshRef.current = canRefresh;
    onRefreshRef.current = onRefresh;
    onRefreshErrorRef.current = onRefreshError;
  }, [canRefresh, onRefresh, onRefreshError]);

  const cancelTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (tickerRef.current) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    deadlineRef.current = 0;
    setRemainingSeconds(null);
  }, []);

  const clearStale = useCallback(() => {
    cancelTimer();
    setStale(false);
  }, [cancelTimer]);

  const refreshNow = useCallback(() => {
    cancelTimer();
    return Promise.resolve(onRefreshRef.current())
      .then(result => {
        setStale(false);
        return result;
      })
      .catch(error => {
        onRefreshErrorRef.current?.(error);
      });
  }, [cancelTimer]);

  const scheduleRefresh = useCallback(() => {
    if (timerRef.current) return;
    if (!canRefreshRef.current) return;
    deadlineRef.current = Date.now() + delayMs;
    setRemainingSeconds(Math.max(1, Math.ceil(delayMs / 1000)));
    tickerRef.current = window.setInterval(() => {
      const nextRemaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemainingSeconds(nextRemaining);
    }, 1000);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
      deadlineRef.current = 0;
      setRemainingSeconds(null);
      if (!canRefreshRef.current) return;
      void refreshNow().catch(() => {});
    }, delayMs);
  }, [delayMs, refreshNow]);

  const markStale = useCallback(() => {
    setStale(true);
    scheduleRefresh();
  }, [scheduleRefresh]);

  useEffect(() => {
    if (!stale) {
      cancelTimer();
      return undefined;
    }
    if (canRefresh) scheduleRefresh();
    else cancelTimer();
    return undefined;
  }, [canRefresh, cancelTimer, scheduleRefresh, stale]);

  useEffect(() => () => cancelTimer(), [cancelTimer]);

  return {
    clearStale,
    isStale: stale,
    markStale,
    remainingSeconds,
    refreshNow
  };
}

export {
  REMOTE_STALE_AUTO_REFRESH_DELAY_MS,
  useStaleAutoRefresh
};
