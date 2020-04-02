'use strict'

const CHAR0 = code('0')
const CHAR9 = code('9')
const CHARa = code('a')
const CHARf = code('f')
const CHARA = code('A')
const CHARF = code('F')
const CHARPOINT = code('.')
const CHARCOLON = code(':')

const IPV4_OCTETS = 4
const IPV6_OCTETS = 16

const constants = {
  // Char codes.
  CHAR0,
  CHAR9,
  CHARa,
  CHARA,
  CHARf,
  CHARF,
  CHARCOLON,
  CHARPOINT,
  // IP octets.
  IPV4_OCTETS,
  IPV6_OCTETS
}

module.exports = {
  einval,
  code,
  isDigit,
  isLetter16,
  isLetter16Low,
  isLetter16Up,
  constants
}

function einval() {
  throw new Error('Invalid value.')
}

function code(char) {
  return String(char).charCodeAt(0)
}

function isDigit(char) {
  return (char >= CHAR0) && (char <= CHAR9)
}

function isLetter16Low(char) {
  return (char >= CHARa) && (char <= CHARf)
}

function isLetter16Up(char) {
  return (char >= CHARA) && (char <= CHARF)
}

function isLetter16(char) {
  return isLetter16Low(char) || isLetter16Up(char)
}
