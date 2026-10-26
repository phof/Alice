import { randomBytes, timingSafeEqual } from 'node:crypto'
import { matchMask, hostmaskOf } from './mask.js'

const OWNER = 'admin:owner'
const ADMINS = 'admins'

/*
  Who may use @commands:
  - the owner: whoever claimed the bot with the one-time code (can't be removed from IRC)
  - admins added by other admins, stored in Redis
  - hostmasks in BOT_ADMINS, if any
*/
export function createAdmins (db, config) {
  let claimCode = null

  const owner = async () => {
    try {
      return await db.get(OWNER)
    } catch (err) {
      console.error('Could not load owner', err.message)
      return null
    }
  }

  const admins = async () => {
    try {
      return (await db.sMembers(ADMINS)).sort()
    } catch (err) {
      console.error('Could not load admins', err.message)
      return []
    }
  }

  const isOwner = async (event) => {
    const mask = await owner()
    return Boolean(mask) && matchMask(mask, hostmaskOf(event))
  }

  const isAdmin = async (event) => {
    const hostmask = hostmaskOf(event)
    if (config.admins.some(mask => matchMask(mask, hostmask))) return true
    if (await isOwner(event)) return true
    return (await admins()).some(mask => matchMask(mask, hostmask))
  }

  return {
    owner,
    admins,
    isOwner,
    isAdmin,

    // Creates a one-time claim code if nobody owns the bot yet.
    // Reads Redis directly so a Redis error throws instead of looking like "no owner"
    async prepareClaim ({ reclaim = false } = {}) {
      if (!reclaim && await db.get(OWNER)) return null
      claimCode = randomBytes(12).toString('base64url')
      return claimCode
    },

    // Returns the new owner mask, or null if the code is wrong or already used
    async claim (code, event) {
      if (!claimCode || !code) return null
      const a = Buffer.from(code)
      const b = Buffer.from(claimCode)
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null

      claimCode = null
      const mask = `*!${event.ident}@${event.hostname}`
      await db.set(OWNER, mask)
      return mask
    },

    setOwner: (mask) => db.set(OWNER, mask),
    add: async (mask) => Boolean(await db.sAdd(ADMINS, mask)),
    remove: async (mask) => Boolean(await db.sRem(ADMINS, mask))
  }
}
