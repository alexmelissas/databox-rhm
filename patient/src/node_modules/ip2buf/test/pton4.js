import test from 'ava'
import { pton4 } from '../'

const EINVAL = 'Invalid value.'

test('pton4', t => {
  t.is(Buffer.compare(pton4('127.0.0.1'), Buffer.from([0x7F, 0, 0, 1])), 0)
  t.is(Buffer.compare(pton4('255.255.255.255'), Buffer.from([0xFF, 0xFF, 0xFF, 0xFF])), 0)
})

test('pton4 errors', t => {
  t.throws(() => pton4('255.255.255*000'), EINVAL)
  t.throws(() => pton4('255.255.255.256'), EINVAL)
  t.throws(() => pton4('2555.0.0.0'), EINVAL)
  t.throws(() => pton4('255'), EINVAL)
})

test('pton4 first argument', t => {
  const typeError = 'Argument 1 should be a string.'

  t.throws(() => pton4(1), typeError)
  t.throws(() => pton4({}), typeError)
  t.throws(() => pton4(/.+/g), typeError)
})

test('pton4 second argument', t => {
  const dest = Buffer.alloc(4)
  const destGt = Buffer.alloc(5)
  const destLt = Buffer.alloc(3)

  const ret1 = pton4('1.1.1.1', dest)
  t.is(Buffer.compare(dest, Buffer.from([1, 1, 1, 1])), 0)
  t.is(ret1, dest)

  const ret2 = pton4('1.1.1.1', destGt)
  t.is(Buffer.compare(destGt, Buffer.from([1, 1, 1, 1, 0])), 0)
  t.is(ret2, destGt)

  t.throws(() => pton4('1.1.1.1', destLt), 'Too small target buffer.')
})

test('pton4 third argument', t => {
  const dest = Buffer.alloc(5)

  t.throws(() => pton4('1.1.1.1', dest, 2), 'Too small target buffer.')

  dest.fill(0)
  t.is(Buffer.compare(pton4('1.1.1.1', dest, 1), Buffer.from([0, 1, 1, 1, 1])), 0)
})
