import { useEffect, useState } from 'react';

/** Relogio da tela, atualizado a cada `intervalMs`. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Fica true depois que `flag` foi true uma vez. Mantem na tela o campo que
 * estava faltando enquanto o consultor preenche (senao ele some na primeira letra).
 */
export function useLatch(flag: boolean): boolean {
  const [latched, setLatched] = useState(flag);
  useEffect(() => {
    if (flag) setLatched(true);
  }, [flag]);
  return latched || flag;
}
