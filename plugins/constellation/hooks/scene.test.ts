import { describe, expect, test } from 'claude-code/testing'

import { SCENE_LIMIT, buildScene, loopDelay } from './scene'
import type { SceneInput } from './scene'
import { REACH, REVEAL_MS, emptyDelta, emptySky, layout, mergeDelta } from './sky'
import type { Sky } from './sky'

const NOW = Date.UTC(2026, 10, 17, 12)
const DAY = 86_400_000

function turn(sky: Sky, at: number, edits: Record<string, number>, reads: string[] = []): Sky {
  const delta = emptyDelta()
  Object.assign(delta.edits, edits)
  for (const path of reads) delta.reads[path] = 1
  return mergeDelta(sky, delta, at)
}

const input = (sky: Sky, now = NOW, meteor = false): SceneInput => ({
  placed: layout(sky),
  constellations: sky.constellations,
  now,
  meteor,
  projectName: 'atlas',
})

/** The fullest sky there can be: 400 stars of long paths, most of them edited often, and 48 constellations. */
function fullSky(): Sky {
  const tops = ['src', 'packages', 'apps', 'tests', 'docs', 'scripts', 'tools', 'infra', 'web', 'server', 'crates', '']
  const subs = ['', 'components', 'lib', 'utils/deep/inner', 'routes', 'api/v2/handlers']
  const types = ['ts', 'tsx', 'rs', 'md', 'json', 'py', 'css', 'go', 'yml', 'sh']
  const files = Array.from({ length: 400 }, (_, index) => {
    const folder = [tops[index % tops.length], subs[(index * 7) % subs.length]].filter(Boolean).join('/')
    return `${folder === '' ? '' : `${folder}/`}a-rather-long-module-name-${index}.${types[index % types.length]}`
  })
  let sky = emptySky()
  for (let index = 0; index < 60; index += 1) {
    const edits: Record<string, number> = {}
    for (let k = 0; k < 9; k += 1) edits[files[(index * 5 + k * 3) % 300] ?? 'x'] = 1 + ((index + k) % 40)
    sky = turn(sky, NOW - (60 - index) * DAY, edits)
  }
  return turn(sky, NOW - DAY, {}, files.filter(file => sky.stars[file] === undefined))
}

/** Every tag opened is closed, in order. */
function isBalanced(svg: string): boolean {
  const open: string[] = []
  for (const match of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = match
    if (selfClosing === '/') continue
    if (closing === '/') {
      if (open.pop() !== name) return false
    } else {
      open.push(name ?? '')
    }
  }
  return open.length === 0
}

/** The markup of the star whose tooltip starts with `path`. */
function starOf(svg: string, path: string): string {
  const at = svg.indexOf(`<title>${path} · `)
  const start = svg.lastIndexOf('<g', at)
  return svg.slice(start, svg.indexOf('</g>', at))
}

/** The constellation lines the document draws, as segments. */
function linesOf(svg: string): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const start = svg.indexOf('stroke-width=".9" stroke-linecap="round">')
  if (start < 0) return []
  const layer = svg.slice(start, svg.indexOf('</g>', start))
  return [...layer.matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g)].map(match => ({
    x1: Number(match[1]),
    y1: Number(match[2]),
    x2: Number(match[3]),
    y2: Number(match[4]),
  }))
}

describe('the document', () => {
  test('an empty sky is a whole, safe document', () => {
    const svg = buildScene(input(emptySky()))
    expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"')
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(svg).toEndWith('</svg>')
    expect(svg).not.toMatch(/<script/i)
    expect(svg).not.toMatch(/\son[a-z]+\s*=/i)
    expect(svg).not.toMatch(/<image|<filter|<mask|mix-blend-mode/)
    for (const match of svg.matchAll(/href="([^"]*)"/g)) expect(match[1]).toStartWith('#')
    expect(svg.match(/<style>/g)).toHaveLength(1)
    expect(svg.match(/<defs>/g)).toHaveLength(1)
    expect(isBalanced(svg)).toBe(true)
  })

  test('places and sizes carry at most one decimal', () => {
    const svg = buildScene(input(fullSky(), NOW, true))
    for (const match of svg.matchAll(/ (?:d|cx|cy|x|y|r|rx|ry|transform)="([^"]*)"/g)) {
      expect(`${match[1]}`).not.toMatch(/\.\d\d/)
    }
  })

  test('the fullest sky stays under 110,000 characters, and balanced', () => {
    const sky = fullSky()
    expect(Object.keys(sky.stars)).toHaveLength(400)
    expect(sky.constellations).toHaveLength(48)
    const svg = buildScene(input(sky, NOW, true))
    expect(svg.length).toBeLessThan(110_000)
    expect(isBalanced(svg)).toBe(true)
  })

  test('very long paths still fit, the read-only stars giving way first', () => {
    let sky = emptySky()
    const long = 'deep/'.repeat(60)
    const edits: Record<string, number> = {}
    for (let index = 0; index < 400; index += 1) edits[`${long}file-${index}.ts`] = 1
    sky = turn(sky, NOW - DAY, edits)
    const svg = buildScene(input(sky))
    expect(svg.length).toBeLessThanOrEqual(SCENE_LIMIT)
    expect(isBalanced(svg)).toBe(true)
  })

  test('hostile file names are escaped and the document still balances', () => {
    const sky = turn(emptySky(), NOW - DAY, { 'a&b<c>".ts': 5, "x'</svg><script>alert(1)</script>.md": 4, 'ctl\u0001\u001b[31m.ts': 3 })
    const svg = buildScene(input(sky))
    expect(svg).toContain('a&amp;b&lt;c&gt;&quot;.ts')
    expect(svg).toContain('x&#39;&lt;/svg&gt;&lt;script&gt;')
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('\u0001')
    expect(svg).not.toContain('\u001b')
    expect(svg.indexOf('</svg>')).toBe(svg.length - 6)
    expect(isBalanced(svg)).toBe(true)
  })

  test('the same input builds the same document', () => {
    const sky = fullSky()
    expect(buildScene(input(sky, NOW, true))).toBe(buildScene(input(sky, NOW, true)))
  })
})

describe('figures', () => {
  test('no drawn line is longer than the reach, even in the fullest sky', () => {
    const lines = linesOf(buildScene(input(fullSky())))
    expect(lines.length).toBeGreaterThan(20)
    for (const line of lines) expect(Math.hypot(line.x2 - line.x1, line.y2 - line.y1)).toBeLessThanOrEqual(REACH)
  })

  test('a turn across two far folders makes two figures and no line between them', () => {
    const sky = turn(emptySky(), NOW - DAY, { 'guide/intro.md': 2, 'guide/setup.md': 1, 'examples/basic.ts': 2, 'examples/heat.ts': 1 })
    const placed = layout(sky)
    const folder = (path: string) => path.split('/')[0]
    const guide = placed.filter(star => folder(star.path) === 'guide')
    const examples = placed.filter(star => folder(star.path) === 'examples')
    // The two folders sit beyond the reach of each other.
    for (const one of guide) for (const other of examples) expect(Math.hypot(one.x - other.x, one.y - other.y)).toBeGreaterThan(REACH)
    const lines = linesOf(buildScene(input(sky)))
    expect(lines).toHaveLength(2)
    const nearest = (x: number, y: number) =>
      placed.reduce((best, star) => (Math.hypot(star.x - x, star.y - y) < Math.hypot(best.x - x, best.y - y) ? star : best))
    for (const line of lines) {
      expect(folder(nearest(line.x1, line.y1).path)).toBe(folder(nearest(line.x2, line.y2).path))
    }
  })

  test('a lone far star of a turn stays unlinked', () => {
    const sky = turn(emptySky(), NOW - DAY, { 'guide/intro.md': 2, 'guide/setup.md': 1, 'examples/basic.ts': 1 })
    const lines = linesOf(buildScene(input(sky)))
    expect(lines).toHaveLength(1)
  })
})

describe('motion', () => {
  test('a new star ignites; an old one rests, and one edited again pulses', () => {
    let sky = turn(emptySky(), NOW - 2 * DAY, { 'old.ts': 2, 'again.ts': 1 })
    sky = turn(sky, NOW - 1000, { 'new.ts': 1, 'again.ts': 1 })
    const svg = buildScene(input(sky))
    expect(starOf(svg, 'new.ts')).toContain('cn-ih')
    expect(starOf(svg, 'old.ts')).not.toContain('cn-ih')
    expect(starOf(svg, 'old.ts')).not.toContain('cn-pulse')
    expect(starOf(svg, 'again.ts')).toContain('cn-pulse')
    // Once the reveal is over, the same sky rests.
    const later = buildScene(input(sky, NOW + REVEAL_MS))
    expect(later).not.toContain('class="cn-h cn-ih"')
    expect(later).not.toContain('class="cn-h cn-pulse"')
  })

  test('new constellations draw themselves in; old ones are drawn already', () => {
    let sky = turn(emptySky(), NOW - DAY, { 'a/one.ts': 1, 'a/two.ts': 1, 'a/three.ts': 1 })
    expect(buildScene(input(sky))).not.toContain('class="cn-dr')
    sky = turn(sky, NOW - 500, { 'b/one.ts': 1, 'b/two.ts': 1 })
    const svg = buildScene(input(sky))
    const drawn = [...svg.matchAll(/<path class="cn-dr[^"]*" pathLength="1"/g)]
    expect(drawn.length).toBeGreaterThanOrEqual(1)
    // The older figure's lines stay one plain path.
    expect(svg).toMatch(/<path stroke-opacity="\.52" d="M/)
  })

  test('the meteor is drawn only when asked, and rests hidden', () => {
    const sky = turn(emptySky(), NOW - DAY, { 'a.ts': 1 })
    expect(buildScene(input(sky))).not.toContain('class="cn-met"')
    const svg = buildScene(input(sky, NOW, true))
    expect(svg).toContain('class="cn-met"')
    expect(svg).toMatch(/\.cn-met\{opacity:0;/)
  })

  test('endless animations pick up where the last document left them', () => {
    const sky = turn(emptySky(), NOW - DAY, { 'a/one.ts': 1, 'a/two.ts': 1 })
    const delays = (svg: string) =>
      [...svg.matchAll(/animation-duration:([\d.]+)s;animation-delay:(-?[\d.]+)s/g)].map(match => ({
        cycle: Number(match[1]) * 2,
        delay: Number(match[2]),
      }))
    const first = delays(buildScene(input(sky, NOW)))
    const second = delays(buildScene(input(sky, NOW + 2000)))
    expect(first.length).toBe(26)
    first.forEach((one, index) => {
      const other = second[index]
      if (other === undefined) throw new Error('a twinkler went missing')
      // Two seconds later the loop stands two seconds further on: the delay is two seconds more negative.
      const moved = (((one.delay - other.delay) % one.cycle) + one.cycle) % one.cycle
      expect(Math.abs(moved - 2)).toBeLessThan(0.15)
    })
    expect(loopDelay(10_000, 4)).toBe(-2)
    expect(loopDelay(12_000, 4) === 0).toBe(true)
  })

  test('asked for less motion, nothing moves and the sky shows finished', () => {
    const svg = buildScene(input(emptySky()))
    expect(svg).toContain('@media (prefers-reduced-motion:reduce){*{animation:none!important}')
  })
})
