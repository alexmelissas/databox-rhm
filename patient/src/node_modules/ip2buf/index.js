'use strict'

const pton4 = require('./lib/pton4')
const pton6 = require('./lib/pton6')
const { constants: { IPV4_OCTETS, IPV6_OCTETS } } = require('./lib/util')

const constants = {
  IPV4_OCTETS,
  IPV6_OCTETS
}

module.exports = {
  pton,
  pton4,
  pton6,
  constants
}

/**
 * Convert ip address to the Buffer.
 *
 * @param {number} af - type of an address.
 * @param {string} addr - source address.
 * @param {Buffer} [dest] - target buffer.
 * @param {number} [index] - start position in the target buffer.
 */
function pton(af, addr, dest, index) {
  switch (af) {
    case IPV4_OCTETS:
      return pton4(addr, dest, index)
    case IPV6_OCTETS:
      return pton6(addr, dest, index)
    default:
      throw new Error('Unsupported ip address.')
  }
}
