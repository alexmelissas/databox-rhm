'use strict'

const {
  einval,
  code,
  isDigit,
  isLetter16,
  isLetter16Low,
  isLetter16Up,
  constants
} = require('./util')
const pton4 = require('./pton4')

const {
  IPV6_OCTETS,
  IPV4_OCTETS,
  CHAR0,
  CHARa,
  CHARA,
  CHARCOLON,
  CHARPOINT
} = constants

module.exports = pton6

/**
 * Faster Buffer#fill().
 *
 * @param {Buffer} buffer
 * @param {number} value
 * @param {number} from
 * @param {number} to
 */
function fill(buffer, value, from, to) {
  for (let i = from; i < to; ++i) {
    buffer[i] = Number(value)
  }
}

/**
 * Convert IPv6 to the Buffer.
 *
 * @param {string} addr
 * @param {Buffer} [dest]
 * @return {Buffer}
 */
function pton6(addr, dest, index = 0) {
  if (typeof addr !== 'string') {
    throw new TypeError('Argument 1 should be a string.')
  }

  if (addr.length <= 0) {
    einval()
  }

  const isbuffer = Buffer.isBuffer(dest)
  const endp = index + IPV6_OCTETS

  if (isbuffer) {
    if (endp > dest.length) {
      throw new Error('Too small target buffer.')
    }
  }

  const buf = isbuffer ? dest : Buffer.allocUnsafe(IPV6_OCTETS)

  let i = 0
  let colonp = null
  let seenDigits = 0
  let val = 0
  let curtok = 0
  let ch = 0

  if (addr[i] === ':') {
    if (addr.length >= 2 && addr[++i] !== ':') {
      einval()
    }
  }

  curtok = i

  while ((ch = i++) < addr.length) {
    const char = code(addr[ch])

    if (isDigit(char) || isLetter16(char)) {
      val <<= 4

      if (isDigit(char)) {
        val |= char - CHAR0
      } else if (isLetter16Low(char)) {
        val |= char - CHARa + 10
      } else if (isLetter16Up(char)) {
        val |= char - CHARA + 10
      }

      if (++seenDigits > 4) {
        einval()
      }
    } else if (char === CHARCOLON) {
      curtok = i

      // If it's second colon in pair.
      if (seenDigits === 0) {
        // Only one colon pair allowed.
        if (colonp !== null) {
          einval()
        }

        colonp = index
        continue
      } else if (i >= addr.length) {
        einval()
      }

      if (index + 2 > endp) {
        einval()
      }

      buf[index++] = (val >> 8) & 0xFF
      buf[index++] = val & 0xFF

      seenDigits = 0
      val = 0
    } else if (char === CHARPOINT) {
      pton4(addr.slice(curtok), buf, index)
      index += IPV4_OCTETS
      seenDigits = 0
      break
    } else {
      einval()
    }
  }

  // Handle last pair.
  if (seenDigits > 0) {
    if (index + 2 > endp) {
      einval()
    }

    buf[index++] = (val >> 8) & 0xFF
    buf[index++] = val & 0xFF
  }

  if (colonp !== null) {
    const n = index - colonp

    if (index === endp) {
      einval()
    }

    buf.copyWithin(endp - n, colonp, colonp + n)
    fill(buf, 0, colonp, endp - n)
  }

  return buf
}
