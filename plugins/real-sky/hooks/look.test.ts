import { expect, test } from 'claude-code/testing'

import { LOOKS } from './look'
import { PHASES } from './phase'

const lightness = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number]
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}

test('Desktop paints every part of the day', () => {
  for (const phase of PHASES) {
    const look = LOOKS[phase]
    expect(look.problems.filter(line => line.startsWith("Desktop won't paint this theme"))).toEqual([])
  }
})

test('day is light; dawn, dusk and night are dark, each with glass of its own', () => {
  expect(LOOKS.day.scheme).toBe('light')
  expect(LOOKS.dawn.scheme).toBe('dark')
  expect(LOOKS.dusk.scheme).toBe('dark')
  expect(LOOKS.night.scheme).toBe('dark')
  expect(new Set(PHASES.map(phase => LOOKS[phase].glass.tint)).size).toBe(4)
  expect(PHASES.map(phase => LOOKS[phase].colors.label)).toEqual(['Real Sky dawn', 'Real Sky day', 'Real Sky dusk', 'Real Sky night'])
})

test('surfaces sit a few percent apart, paper on paper', () => {
  for (const phase of PHASES) {
    const { anchors } = LOOKS[phase]
    const steps = [anchors['surface-0'], anchors['surface-1'], anchors['surface-2']].map(lightness)
    for (let i = 1; i < steps.length; i++) {
      const gap = (steps[i] ?? 0) - (steps[i - 1] ?? 0)
      expect(gap).toBeGreaterThan(0)
      expect(gap).toBeLessThan(0.04)
    }
  }
})
