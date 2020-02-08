'use strict'

const test = require('tape')
const isStun = require('./')

test('should work', t => {
  t.true(isStun(Buffer.from([0, 0x1, 0x2])))
  t.true(isStun(Buffer.from([0x1, 0x1, 0x2])))
  t.true(isStun(Buffer.from([0x2, 0x1, 0x2])))
  t.true(isStun(Buffer.from([0x3, 0x1, 0x2])))
  t.false(isStun(Buffer.from([0x4, 0x1, 0x2])))

  t.end()
})

test('should be false', t => {
  t.false(isStun(1))
  t.false(isStun(NaN))
  t.false(isStun(null))
  t.false(isStun(undefined))
  t.false(isStun({}))
  t.false(isStun(''))
  t.false(isStun(Buffer.alloc(0)))

  t.end()
})
