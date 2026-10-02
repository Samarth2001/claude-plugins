// Renders plugins/buddy/assets/moods.svg, the animated mood gallery in buddy's
// README, from the same sprite code the mod draws with.
//
//   node --experimental-strip-types scripts/assets/buddy-moods.mts
//   node --experimental-strip-types scripts/assets/buddy-moods.mts --check   (CI: fail if stale)

import { readFileSync, writeFileSync } from 'node:fs'

import { animation, svg } from '../../plugins/buddy/hooks/sprite.ts'
import type { Mood } from '../../plugins/buddy/types/index.d.ts'

const OUT = new URL('../../plugins/buddy/assets/moods.svg', import.meta.url)

const CELLS: { mood: Mood; percent: number; label: string }[] = [
  { mood: 'idle', percent: 20, label: 'ready' },
  { mood: 'thinking', percent: 20, label: 'thinking' },
  { mood: 'reading', percent: 20, label: 'reading' },
  { mood: 'editing', percent: 20, label: 'editing' },
  { mood: 'running', percent: 35, label: 'running' },
  { mood: 'browsing', percent: 35, label: 'browsing' },
  { mood: 'delegating', percent: 35, label: 'delegating' },
  { mood: 'working', percent: 35, label: 'using a tool' },
  { mood: 'done', percent: 55, label: 'done' },
  { mood: 'sleeping', percent: 55, label: 'dozing' },
  { mood: 'error', percent: 55, label: 'oops' },
  { mood: 'full', percent: 93, label: 'stuffed (93%)' },
]

const SCALE = 5
const COLUMNS = 4
const CELL_W = 19 * SCALE + 40
const CELL_H = 8 * SCALE + 30

const cells = CELLS.map(({ mood, percent, label }, i) => {
  const x = (i % COLUMNS) * CELL_W + 10
  const y = Math.floor(i / COLUMNS) * CELL_H + 10
  const sprite = svg(animation(mood, { percent, isSweating: percent >= 75 && percent < 90 }), SCALE)
    .replace('<svg ', `<svg x="${x}" y="${y}" `)
    .replace(/ style="[^"]*"/, '')
  return `${sprite}<text x="${x}" y="${y + 8 * SCALE + 18}">${label}</text>`
}).join('')

const width = COLUMNS * CELL_W + 10
const height = Math.ceil(CELLS.length / COLUMNS) * CELL_H + 10
const gallery =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
  `<style>text{font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:#8b949e}</style>` +
  `${cells}</svg>\n`

if (process.argv.includes('--check')) {
  const current = readFileSync(OUT, 'utf8')
  if (current !== gallery) {
    console.error('plugins/buddy/assets/moods.svg is stale: run node --experimental-strip-types scripts/assets/buddy-moods.mts')
    process.exit(1)
  }
  console.log('moods.svg is up to date')
} else {
  writeFileSync(OUT, gallery)
  console.log(`wrote ${OUT.pathname}`)
}
