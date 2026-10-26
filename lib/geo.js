import { getJSON } from './http.js'

/*
  Looks up a place with the Open-Meteo geocoding API (free, no API key).
  Accepts "Paris" or "Paris, US" / "Paris, Texas" to disambiguate.
*/
export async function geocode (query) {
  const [name, hint] = query.split(',').map(s => s.trim())
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.search = new URLSearchParams({ name, count: hint ? '10' : '1', language: 'en', format: 'json' })

  const { results = [] } = await getJSON(url)
  if (!hint) return results[0] ?? null

  const h = hint.toLowerCase()
  return results.find(r => [r.country, r.country_code, r.admin1].some(v => v?.toLowerCase() === h)) ??
    results[0] ?? null
}

export const placeName = (place) => [place.name, place.country].filter(Boolean).join(', ')
