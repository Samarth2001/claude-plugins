import { expect, test } from 'claude-code/testing'

import { PHASES } from './phase'
import type { Weather } from './phase'
import { FRAMES, SCENE_LIMIT, buildScene, mix, moonPath, pointOn, skyAt } from './scene'

const WEATHERS: readonly Weather[] = ['clear', 'cloudy', 'storm']

test('every sky fits an Svg, fills any screen and stills for reduced motion', () => {
  for (const phase of PHASES) {
    for (const weather of WEATHERS) {
      for (const progress of [0, 0.5, 1]) {
        const svg = buildScene({ phase, progress, weather, moonAge: 12 })
        expect(svg.length).toBeLessThan(SCENE_LIMIT)
        expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"')
        expect(svg).toContain('preserveAspectRatio="xMidYMid slice"')
        expect(svg).toContain('@media (prefers-reduced-motion:reduce){*{animation:none!important}')
        expect(svg).not.toContain('<script')
        expect(svg).not.toContain('href=')
        expect(svg).not.toContain('NaN')
        expect(svg).not.toContain('undefined')
      }
    }
  }
})

test('the same input draws the same sky', () => {
  const input = { phase: 'dusk', progress: 0.4, weather: 'cloudy', moonAge: 3 } as const
  expect(buildScene(input)).toBe(buildScene(input))
})

test('grain keeps the gradient from banding', () => {
  expect(buildScene({ phase: 'night', progress: 0.5, weather: 'clear' })).toContain('<feTurbulence type="fractalNoise"')
})

test('a storm brings fine rain and a cloud band that brightens; clear skies have only thin cirrus', () => {
  const storm = buildScene({ phase: 'day', progress: 0.5, weather: 'storm' })
  expect(storm).toContain('class="rs-rain"')
  expect(storm).toContain('class="rs-flash"')
  const clear = buildScene({ phase: 'day', progress: 0.5, weather: 'clear' })
  expect(clear).not.toContain('class="rs-rain"')
  expect(clear).not.toContain('class="rs-flash"')
  expect(clear).toContain('fill="url(#rs-wisp)"')
  expect(buildScene({ phase: 'night', progress: 0.5, weather: 'cloudy' })).not.toContain('class="rs-flash"')
})

test('night has the moon and a few twinkling stars; day has the sun and no stars', () => {
  const night = buildScene({ phase: 'night', progress: 0.5, weather: 'clear', moonAge: 10 })
  expect(night).toContain('class="rs-moon"')
  expect(night).toContain('class="rs-tws"')
  expect(night).not.toContain('class="rs-sun"')
  const group = night.slice(night.indexOf('class="rs-tws"'))
  const twinkles = group.slice(0, group.indexOf('</g>')).match(/<circle/g)?.length ?? 0
  expect(twinkles).toBeGreaterThan(2)
  expect(twinkles).toBeLessThan(10)
  const day = buildScene({ phase: 'day', progress: 0.5, weather: 'clear' })
  expect(day).toContain('class="rs-sun"')
  expect(day).not.toContain('class="rs-tws"')
})

test('the notes print the hour, the weather and, after dark, the moon', () => {
  const dusk = buildScene({ phase: 'dusk', progress: 0.3, weather: 'clear', time: { hour: 17, minute: 54 } })
  expect(dusk).toContain('>DUSK · 17:54<')
  expect(dusk).toContain('>CLEAR SKY<')
  const night = buildScene({ phase: 'night', progress: 0.5, weather: 'cloudy', moonAge: 14.8 })
  expect(night).toContain('>NIGHT · 00:30<')
  expect(night).toContain('>OVERCAST · FULL MOON 100%<')
})

test('the horizon stands the same at every hour', () => {
  const land = (svg: string) => svg.match(/<g class="rs-low"><path d="[^"]*"/)?.[0]
  const dawn = land(buildScene({ phase: 'dawn', progress: 0, weather: 'clear' }))
  expect(dawn).toBeDefined()
  expect(land(buildScene({ phase: 'night', progress: 0.9, weather: 'storm' }))).toBe(dawn)
})

test('the land stays low: hills and towers in the bottom sixth, only hairlines a little above', () => {
  const svg = buildScene({ phase: 'dusk', progress: 0.5, weather: 'clear' })
  const low = svg.slice(svg.indexOf('<g class="rs-low">'), svg.indexOf('</g>', svg.lastIndexOf('rs-beacon')))
  const highest = (paths: string[]) =>
    Math.min(...paths.flatMap(d => [...d.matchAll(/[MLV]-?[\d.]+(?: ([\d.]+))?/g)].map(match => Number(match[1] ?? match[0].slice(1)))))
  const filled = [...low.matchAll(/<path d="([^"]*)" fill="#/g)].map(match => match[1] ?? '')
  const hairlines = [...low.matchAll(/<path d="([^"]*)" stroke=/g)].map(match => match[1] ?? '')
  expect(highest(filled)).toBeGreaterThan(830)
  expect(highest(hairlines)).toBeGreaterThan(800)
})

test('each arc keeps to the top and inside what its aspect shows', () => {
  // Wide shows all 1600 across; squarish from 425 to 1175; a tall phone from about 570 to 1030.
  const bounds = [
    [100, 1500],
    [425, 1175],
    [570, 1030],
  ] as const
  FRAMES.forEach((frame, i) => {
    const [left, right] = bounds[i] ?? [0, 1600]
    for (let t = 0; t <= 1; t += 0.05) {
      const { x, y } = pointOn(frame, t)
      expect(x - frame.body - 8).toBeGreaterThanOrEqual(left)
      expect(x + frame.body + 8).toBeLessThanOrEqual(right)
      expect(y).toBeLessThanOrEqual(640)
    }
    // Its apex clears the middle of the window, where the words sit.
    expect(pointOn(frame, 0.5).y).toBeLessThan(200)
  })
})

test('the moon is drawn in its phase: a sliver near new, nearly round near full', () => {
  const width = (d: string) => {
    const radii = [...d.matchAll(/A([\d.]+) /g)].map(match => Number(match[1]))
    return radii[1] ?? 0
  }
  expect(width(moonPath(0, 0, 10, 1))).toBeGreaterThan(9) // a thin crescent: the terminator near the limb
  expect(width(moonPath(0, 0, 10, 7.38))).toBeLessThan(0.5) // a quarter: the terminator straight
  expect(moonPath(0, 0, 10, 3)).toContain('0 0 1 0 10') // waxing: lit on the right
  expect(moonPath(0, 0, 10, 26)).toContain('0 0 0 0 10') // waning: lit on the left
})

test('skies move through their colors and stay muted', () => {
  expect(skyAt('dawn', 0)).not.toEqual(skyAt('dawn', 1))
  expect(skyAt('night', 0)).toEqual(skyAt('night', 1))
  for (const phase of PHASES) {
    for (const color of skyAt(phase, 0.5)) {
      const [r, g, b] = [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16)) as [number, number, number]
      // No candy: the spread of the channels stays well short of a saturated color.
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(110)
    }
  }
})

test('colors mix channel by channel', () => {
  expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  expect(mix('#102030', '#102030', 0.7)).toBe('#102030')
})
