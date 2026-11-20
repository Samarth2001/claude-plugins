import { expect, test } from 'claude-code/testing'

import { STILL_ALT, stillSvg } from './still'

const ROOT = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">'
const BOTH = [stillSvg(false), stillSvg(true)]

test('day and night share the root, stay small, and differ', () => {
  for (const svg of BOTH) {
    expect(svg).toStartWith(ROOT)
    expect(svg.length).toBeLessThan(12_000)
  }
  expect(BOTH[0]).not.toBe(BOTH[1])
})

test('the picture is pure vector, its references all local', () => {
  for (const svg of BOTH) {
    for (const banned of ['<image', '<script', '<style', '<text', 'href', 'data:', '&#', 'foreignObject']) expect(svg).not.toContain(banned)
    const urls = svg.match(/url\(/g) ?? []
    const local = svg.match(/url\(#/g) ?? []
    expect(urls.length).toBeGreaterThan(0)
    expect(local.length).toBe(urls.length)
  }
})

test('the same hour draws the same picture', () => {
  expect(stillSvg(false)).toBe(BOTH[0])
  expect(stillSvg(true)).toBe(BOTH[1])
})

test('the alt is one plain sentence', () => {
  expect(STILL_ALT.length).toBeGreaterThan(20)
  expect(STILL_ALT).not.toContain('\n')
})
