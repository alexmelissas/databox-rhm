'use strict'

const numberInRange = byte => byte >= 0 && byte <= 3

module.exports = isStun

function isStun(packet) {
  if (Buffer.isBuffer(packet) && packet.length > 0) {
    return numberInRange(packet[0])
  }

  return false
}
