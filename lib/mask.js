// IRC-style glob matching for hostmasks, i.e. "*!*@example.com" or "alice!~a?ice@*"

const escape = (s) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')

export function maskToRegExp (mask) {
  const pattern = escape(mask).replace(/\*/g, '.*').replace(/\?/g, '.')
  return new RegExp(`^${pattern}$`, 'i')
}

export function matchMask (mask, hostmask) {
  return maskToRegExp(mask).test(hostmask)
}

export function isValidMask (mask) {
  return /^[^\s!@]+![^\s!@]+@[^\s!@]+$/.test(mask)
}

export const hostmaskOf = ({ nick, ident, hostname }) => `${nick}!${ident}@${hostname}`
