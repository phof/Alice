const units = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }
const aliases = Object.fromEntries(Object.entries({
  s: ['s', 'sec', 'secs', 'second', 'seconds'],
  m: ['m', 'min', 'mins', 'minute', 'minutes'],
  h: ['h', 'hr', 'hrs', 'hour', 'hours'],
  d: ['d', 'day', 'days'],
  w: ['w', 'wk', 'week', 'weeks']
}).flatMap(([unit, names]) => names.map(name => [name, unit])))

/*
  Parses a duration at the start of text, i.e. "in 2h take the tea out" or "1h30m stand up".
  Returns { ms, rest } or null.
*/
export function parseDuration (text) {
  const match = text.match(/^(?:in\s+)?((?:\d+\s*[a-z]+\s*)+?)(?:\s+|$)(.*)$/is)
  if (!match) return null

  let seconds = 0
  for (const [, amount, unit] of match[1].matchAll(/(\d+)\s*([a-z]+)/gi)) {
    const alias = aliases[unit.toLowerCase()]
    if (!alias) return null
    seconds += Number(amount) * units[alias]
  }
  return seconds > 0 ? { ms: seconds * 1000, rest: match[2].trim() } : null
}

// 7380000 -> "2h 3m"
export function formatDuration (ms) {
  let seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const parts = []
  for (const unit of ['w', 'd', 'h', 'm']) {
    const n = Math.floor(seconds / units[unit])
    if (n) parts.push(`${n}${unit}`)
    seconds %= units[unit]
  }
  return parts.slice(0, 2).join(' ')
}

export const ago = (time, now = Date.now()) => `${formatDuration(now - time)} ago`
