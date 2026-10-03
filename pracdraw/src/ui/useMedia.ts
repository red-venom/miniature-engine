// useMedia.ts — true while a media query matches.

import { useEffect, useState } from 'react'

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    on()
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}
