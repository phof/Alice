export async function getJSON (url, options = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), ...options })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`)
  return res.json()
}
