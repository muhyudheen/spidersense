import { useSyncExternalStore } from 'react'

// Hash-based routing: "#/redteam" → "redteam". No router library; the browser's hashchange event is enough.

// The route id for a location hash, or `fallback` when the hash is empty or names no known route.
export function parseHash(hash, known, fallback) {
  const id = String(hash || '').replace(/^#\/?/, '').split(/[/?]/)[0].toLowerCase()
  return known.includes(id) ? id : fallback
}

export const hrefFor = (id) => `#/${id}`

const subscribe = (onChange) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

// The current route id; re-renders when the hash changes.
export function useHashRoute(known, fallback) {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseHash(hash, known, fallback)
}

export function navigate(id) {
  window.location.hash = hrefFor(id)
}
