# is-stun

[![Build Status](https://travis-ci.org/nodertc/is-stun.svg?branch=master)](https://travis-ci.org/nodertc/is-stun)
[![npm](https://img.shields.io/npm/v/is-stun.svg)](https://npmjs.org/package/is-stun)
[![node](https://img.shields.io/node/v/is-stun.svg)](https://npmjs.org/package/is-stun)
[![license](https://img.shields.io/npm/l/is-stun.svg)](https://npmjs.org/package/is-stun)
[![downloads](https://img.shields.io/npm/dm/is-stun.svg)](https://npmjs.org/package/is-stun)

Check if a Buffer is a [STUN](https://tools.ietf.org/html/rfc5389) message. Used for demultiplex packets that are arriving on the same port. Follows [RFC7983](https://tools.ietf.org/html/rfc7983#section-7).

## Usage

```js
const dgram = require('dgram')
const is_stun = require('is-stun')

const socket = dgram.createSocket('udp4')

socket.on('message', (packet) => {
  if (is_stun(packet)) {
    // handle STUN...
  }
})

socket.bind(0)
```

## Related projects

* [`is-dtls`](https://github.com/nodertc/is-dtls) - Check if a Buffer is a [DTLS](https://tools.ietf.org/html/rfc4347) message.
* [`is-turn`](https://github.com/nodertc/is-turn) - Check if a Buffer is a [TURN](https://tools.ietf.org/html/rfc5766) message.
* [`is-rtp`](https://github.com/nodertc/is-rtp) - Check if a Buffer is a [RTP/RTCP](https://tools.ietf.org/html/rfc3550) message.

## License

MIT, 2017 (c) Dmitry Tsvettsikh
