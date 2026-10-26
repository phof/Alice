import { createClient } from 'redis'

export function connectRedis (url) {
  const db = createClient({
    url,
    // Fail fast instead of queueing commands while Redis is unreachable
    disableOfflineQueue: true,
    // Redis Enterprise maintenance events, not relevant for a local Redis
    maintNotifications: 'disabled'
  })
  db.on('error', (err) => console.error('Redis error', err.message))
  db.connect().catch(err => console.error('Redis connection failed', err.message))
  return db
}

export async function scanKeys (db, pattern) {
  const keys = []
  for await (const batch of db.scanIterator({ MATCH: pattern, COUNT: 100 })) keys.push(...batch)
  return keys.sort()
}
