import { expect, test } from 'claude-code/testing'

import { STILL_ALT, stillSvg } from './still'

const ROOT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">'
const BOTH = [stillSvg(false), stillSvg(true)]

test('day and night share one root, stay small, and differ', () => {
  for (const svg of BOTH) {
    expect(svg).toStartWith(ROOT)
    expect(svg.length).toBeLessThan(12_000)
  }
  expect(BOTH[0]).not.toBe(BOTH[1])
})

test('both are pure vector, with only local references', () => {
  for (const svg of BOTH) {
    for (const word of ['<image', '<script', '<style', '<text', 'href', 'data:', '&#', 'foreignObject']) {
      expect(svg).not.toContain(word)
    }
    const urls = svg.match(/url\(/g) ?? []
    expect(urls.length).toBeGreaterThan(0)
    expect(svg.match(/url\(#/g) ?? []).toHaveLength(urls.length)
  }
})

test('each is the same on a second call, under one plain sentence', () => {
  expect(stillSvg(false)).toBe(BOTH[0])
  expect(stillSvg(true)).toBe(BOTH[1])
  expect(STILL_ALT).toMatch(/^[A-Z][^.]*\.$/)
})
