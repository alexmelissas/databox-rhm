# ip2buf
[![travis](https://travis-ci.org/reklatsmasters/ip2buf.svg?branch=master)](https://travis-ci.org/reklatsmasters/ip2buf)
[![npm](https://img.shields.io/npm/v/ip2buf.svg)](https://npmjs.org/package/ip2buf)
[![license](https://img.shields.io/npm/l/ip2buf.svg)](https://npmjs.org/package/ip2buf)
[![downloads](https://img.shields.io/npm/dm/ip2buf.svg)](https://npmjs.org/package/ip2buf)

Convert IPv4 or IPv6 address to the Buffer.

## Usage

```js
const { pton4, pton6 } = require('ip2buf')

pton4('8.8.8.8') // Buffer<0x8, 0x8, 0x8, 0x8>
pton6('2001::')  // Buffer<0x20, 0x01, 0, ...>
```

## Perfomance

* IPv4

| library | time (2e6 times) |
| --- | --- |
| native | 296.627ms |
| ip2buf | 283.710ms |
| ipaddr.js | 1728.538ms |

* IPv6

| library | time (1e6 times) |
| --- | --- |
| native | 333.071ms |
| ip2buf | 767.788ms |
| ipaddr.js | 1828.334ms |

## API

* `pton(af: number, addr: string, [[dest: Buffer], index: number]): Buffer`

Convert IPv4 or IPv6 address to the Buffer.

```js
const { pton, constants: { IPV4_OCTETS, IPV6_OCTETS } } = require('ip2buf')

pton(IPV4_OCTETS, '127.0.0.1')
pton(IPV6_OCTETS, '::1')
```

* `pton4(addr: string, [[dest: Buffer], index: number]): Buffer`

Convert IPv4 address to the Buffer.

* `pton6(addr: string, [[dest: Buffer], index: number]): Buffer`

Convert IPv6 address to the Buffer.

* `constants: Object`

  - `IPV4_OCTETS` - size of IPv4 target buffer.
  - `IPV6_OCTETS` - size of IPv6 target buffer.

## Related

* [date2buffer](https://github.com/ReklatsMasters/date2buffer) - convert Date to the Buffer.

## License
MIT, 2017 (c) Dmitry Tsvettsikh
