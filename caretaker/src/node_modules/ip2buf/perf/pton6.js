const { isIPv6 } = require('net')
const { pton6 } = require('../')
const ipaddr = require('ipaddr.js')

let i = 0
const addrs = []

loop: for(let a = 0; a < 0xffff; ++a) {
  for (let b = 0; b < 0xffff; ++b) {
    addrs.push(`2001:0db8:11a3:09d7:${a.toString(16)}:${b.toString(16)}::1`)

    if (++i >= 1e6) {
      break loop
    }
  }
}

let ret = false

console.time('native')
for(const addr of addrs) {
  if (isIPv6(addr)) {
    ret = !ret
  }
}
console.timeEnd('native')

const dest = Buffer.allocUnsafe(16)

function isip6(addr) {
  try {
    pton6(addr, dest)
    return true
  }
  catch(e) {
    return false
  }
}

console.time('ip2buf')
for(const addr of addrs) {
  if (isip6(addr)) {
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
