import { useState, useEffect, useCallback } from 'react';

export function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      if (!navigator.onLine) return;
      // Signal that we just came back online
      setWasOffline(true);
      setTimeout(() => setWasOffline(false), 5000);
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { online, wasOffline };
}
