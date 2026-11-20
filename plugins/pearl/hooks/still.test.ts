import { expect, test } from 'claude-code/testing'

import { STILL_ALT, stillSvg } from './still'

const ROOT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">'

test('day and night share the root, stay small and differ', () => {
  const day = stillSvg(false)
  const night = stillSvg(true)
  for (const svg of [day, night]) {
    expect(svg).toStartWith(ROOT)
    expect(svg.length).toBeLessThan(12_000)
  }
  expect(day).not.toBe(night)
})

test('each is pure vector, with only local references', () => {
  for (const svg of [stillSvg(false), stillSvg(true)]) {
    for (const banned of ['<image', '<script', '<style', '<text', 'href', 'data:', '&#', 'foreignObject']) {
      expect(svg.includes(banned)).toBe(false)
    }
    const urls = svg.match(/url\(/g) ?? []
    expect(urls.length).toBeGreaterThan(0)
    expect(svg.match(/url\(#/g) ?? []).toHaveLength(urls.length)
  }
})

test('each is the same on a second call, and the alt is one sentence', () => {
  expect(stillSvg(false)).toBe(stillSvg(false))
  expect(stillSvg(true)).toBe(stillSvg(true))
  expect(STILL_ALT).toMatch(/^[A-Z][^.]*\.$/)
})
