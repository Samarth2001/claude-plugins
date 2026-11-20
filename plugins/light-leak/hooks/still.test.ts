import { expect, test } from 'claude-code/testing'

import { STILL_ALT, stillSvg } from './still'

const ROOT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">'
const BOTH = [stillSvg(false), stillSvg(true)]

test('day and night share the root, stay small and differ', () => {
  for (const svg of BOTH) {
    expect(svg).toStartWith(ROOT)
    expect(svg.length).toBeLessThan(12_000)
  }
  expect(BOTH[0]).not.toBe(BOTH[1])
})

test('the frame is pure vector, and refers only to itself', () => {
  for (const svg of BOTH) {
    for (const word of ['<image', '<script', '<style', '<text', 'href', 'data:', '&#', 'foreignObject']) {
      expect(svg).not.toContain(word)
    }
    expect(svg.split('url(').length).toBe(svg.split('url(#').length)
  }
})

test('the same hour draws the same frame', () => {
  expect(stillSvg(false)).toBe(BOTH[0])
  expect(stillSvg(true)).toBe(BOTH[1])
})

test('the description is one plain sentence', () => {
  expect(STILL_ALT).toMatch(/^[A-Z][^.]*[a-z]$/)
})
