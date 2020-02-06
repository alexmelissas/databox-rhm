const { isIPv4 } = require('net')
const { pton4 } = require('../')
const ipaddr = require('ipaddr.js')

let i = 0
const addrs = []

loop: for(let a = 0; a < 0xff; ++a) {
  for(let b = 0; b < 0xff; ++b) {
    for(let c = 0; c < 0xff; ++c) {
      for(let d = 0; d < 0xff; ++d) {
        addrs.push(`${a}.${b}.${c}.${d}`)

        if (++i >= 2e6) {
          break loop
        }
      }
    }
  }
}

let ret = false

console.time('native')
for(const addr of addrs) {
  if (isIPv4(addr)) {
    ret = !ret
  }
}
console.timeEnd('native')

const dest = Buffer.allocUnsafe(4)

function isip4(addr) {
  try {
    pton4(addr, dest)
    return true
  }
  catch(e) {
    return false
  }
}

console.time('ip2buf')
for(const addr of addrs) {
  if (isip4(addr)) {
    ret = !ret
  }
}
console.timeEnd('ip2buf')

console.time('ipaddr.js')
for(const addr of addrs) {
  if (ipaddr.isValid(addr)) {
    ret = !ret
  }
}
console.timeEnd('ipaddr.js')
