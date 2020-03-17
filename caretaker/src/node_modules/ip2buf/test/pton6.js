import test from 'ava'
import { pton6 } from '../'

const EINVAL = 'Invalid value.'
const ESMALL = 'Too small target buffer.'

test('pton6', t => {
  t.is(Buffer.compare(pton6('::'), Buffer.alloc(16)), 0)

  const dest1 = Buffer.alloc(16)
  dest1[15] = 1
  t.is(Buffer.compare(pton6('::1'), dest1), 0)

  const dest2 = Buffer.alloc(16)
  dest2[0] = 0xFE
  dest2[1] = 0x80
  dest2[15] = 1
  t.is(Buffer.compare(pton6('fe80::1'), dest2), 0)

  const dest3 = Buffer.alloc(16)
  dest3[0] = 0xFE
  dest3[1] = 0x80
  t.is(Buffer.compare(pton6('fe80::'), dest3), 0)

  const dest4 = Buffer.from([0xFE, 0x80, 0, 0, 0, 0, 0, 0, 0x2A, 0xCF, 0xDA, 0xFF, 0xFE, 0xDD, 0x34, 0x2A])
  t.is(Buffer.compare(pton6('fe80::2acf:daff:fedd:342a'), dest4), 0)

  t.is(Buffer.compare(pton6('fe80:0:0:0:2acf:daff:fedd:342a'), dest4), 0)

  const dest5 = Buffer.from([0xFE, 0x80, 0, 0, 0, 0, 0, 0, 0x2A, 0xCF, 0xDA, 0xFF, 0x1, 0x2, 0x3, 0x4])
  t.is(Buffer.compare(pton6('fe80:0:0:0:2acf:daff:1.2.3.4'), dest5), 0)

  const dest6 = Buffer.alloc(16, 0xFF)
  t.is(Buffer.compare(pton6('ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255'), dest6), 0)
})

test('pton6 errors', t => {
  t.throws(() => pton6(':::1'), EINVAL)
  t.throws(() => pton6('abcde::1'), EINVAL)
  t.throws(() => pton6('fe80:0:0:0:2acf:daff:fedd:342a:5678'), EINVAL)
  t.throws(() => pton6('fe80:0:0:0:2acf:daff:abcd:1.2.3.4'), ESMALL)
  t.throws(() => pton6('fe80:0:0:2acf:daff:1.2.3.4.5'), EINVAL)
  t.throws(() => pton6('ffff:ffff:ffff:ffff:ffff:ffff:255.255.255.255.255'), EINVAL)
})

test('pton6 first argument', t => {
  const typeError = 'Argument 1 should be a string.'

  t.throws(() => pton6(1), typeError)
  t.throws(() => pton6({}), typeError)
  t.throws(() => pton6(/.+/g), typeError)
})

test('pton6 second argument', t => {
  const dest = Buffer.alloc(16)
  const destGt = Buffer.alloc(17)
  const destLt = Buffer.alloc(13)

  const ret1 = pton6('::', dest)
  t.is(Buffer.compare(dest, Buffer.alloc(16)), 0)
  t.is(ret1, dest)

  const ret2 = pton6('::1', destGt)
  const dest2 = Buffer.alloc(destGt.length)
  dest2[15] = 1
  t.is(Buffer.compare(destGt, dest2), 0)
  t.is(ret2, destGt)

  t.throws(() => pton6('::', destLt), ESMALL)
})

test('pton6 third argument', t => {
  const dest = Buffer.alloc(17)

  t.throws(() => pton6('1::1', dest, 2), ESMALL)

  const res = Buffer.alloc(dest.length)
  res[2] = 1
  res[16] = 1
  t.is(Buffer.compare(pton6('1::1', dest, 1), res), 0)
})
