'use strict'

const { code, einval, isDigit, constants } = require('./util')

const { IPV4_OCTETS, CHAR0, CHARPOINT } = constants

module.exports = pton4

/**
 * Convert IPv4 to the Buffer.
 *
 * @param {string} addr
 * @param {Buffer} [dest]
 * @param {number} [index=0]
 * @returns {Buffer}
 */
function pton4(addr, dest, index = 0) {
  if (typeof addr !== 'string') {
    throw new TypeError('Argument 1 should be a string.')
  }

  if (arguments.length >= 3) {
    if (typeof index !== 'number') {
      throw new TypeError('Argument 3 should be a Number.')
    }
  }

  const isbuffer = Buffer.isBuffer(dest)

  if (isbuffer) {
    if (index + IPV4_OCTETS > dest.length) {
      throw new Error('Too small target buffer.')
    }
  }

  const buf = isbuffer ? dest : Buffer.allocUnsafe(IPV4_OCTETS)

  let octets = 0
  let sawDigit = false
  let number = 0

  for (let i = 0; i < addr.length; ++i) {
    const char = code(addr[i])

    if (isDigit(char)) {
      number = (number * 10) + (char - CHAR0)

      if (sawDigit && number === 0) {
        einval()
      }

      if (number > 0xFF) {
        einval()
      }

      if (!sawDigit) {
        if (++octets > IPV4_OCTETS) {
          einval()
        }
        sawDigit = true
      }
    } else if (char === CHARPOINT && sawDigit) {
      if (octets === IPV4_OCTETS) {
        einval()
      }

      buf[index++] = number
      number = 0
      sawDigit = false
    } else {
      einval()
    }
  }

  if (octets < IPV4_OCTETS) {
    einval()
  }

  if (sawDigit) {
    buf[index] = number
  }

  return buf
}
