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

// The part after the route id: "#/redteam/exfil_email" → "exfil_email" ('' when there is none).
export function parseHashParam(hash) {
  return decodeURIComponent(String(hash || '').replace(/^#\/?/, '').split('?')[0].split('/')[1] || '')
}

// The current hash's param; re-renders when the hash changes.
export function useHashParam() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseHashParam(hash)
}
