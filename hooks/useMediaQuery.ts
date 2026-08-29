import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia(query);
    // Use modern addEventListener API (addListener is deprecated).
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    if (media.matches !== matches) setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
    // query is the only real dependency; matches is updated by the listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return matches;
}