import { describe, expect, test } from 'claude-code/testing'

import {
  MAX_CONSTELLATIONS,
  MAX_STARS,
  REACH,
  SAFE,
  emptyDelta,
  emptySky,
  isEmptyDelta,
  isTestCommand,
  joinNear,
  layout,
  mergeDelta,
  parseSky,
  relativePath,
  spanningTree,
  spectralClass,
  summary,
} from './sky'
import type { Delta, Sky } from './sky'

const NOW = Date.UTC(2026, 10, 17, 12)

const delta = (edits: Record<string, number>, reads: Record<string, number> = {}): Delta => ({
  ...emptyDelta(),
  edits: Object.assign(emptyDelta().edits, edits),
  reads: Object.assign(emptyDelta().reads, reads),
})

/** A plausible project of `count` files across nested folders, each edited or read once, born in order. */
export function bigSky(count: number): Sky {
  const folders = ['src', 'src/components', 'src/lib', 'src/lib/util', 'tests', 'docs', 'scripts', 'packages/core', 'packages/ui', 'app/routes', '']
  const types = ['ts', 'tsx', 'md', 'json', 'css', 'py', 'rs', 'yml']
  let sky = emptySky()
  for (let index = 0; index < count; index += 1) {
    const folder = folders[index % folders.length] ?? ''
    const file = `${folder === '' ? '' : `${folder}/`}file-${index}.${types[index % types.length]}`
    sky = mergeDelta(sky, index % 3 === 0 ? delta({}, { [file]: 1 }) : delta({ [file]: 1 + (index % 7) }), NOW + index * 10)
  }
  return sky
}

describe('parseSky', () => {
  test('garbage and a wrong version give an empty sky', () => {
    for (const value of [undefined, null, 3, 'sky', [], {}, { version: 2, stars: {}, constellations: [] }]) {
      expect(parseSky(value)).toEqual(emptySky())
    }
    const badStar = { version: 1, stars: { 'a.ts': { edits: -1, reads: 0, born: 1, touched: 1 } }, constellations: [] }
    expect(Object.keys(parseSky(badStar).stars)).toHaveLength(0)
    const badFigure = { version: 1, stars: {}, constellations: [{ at: 1, files: [3] }] }
    expect(parseSky(badFigure).constellations).toHaveLength(0)
  })

  test('a valid sky comes back whole, and survives a JSON round trip', () => {
    const sky = mergeDelta(emptySky(), delta({ 'a.ts': 2, 'b.md': 1 }, { 'c.json': 1 }), NOW)
    const back = parseSky(JSON.parse(JSON.stringify(sky)))
    expect(back.stars['a.ts']).toEqual({ edits: 2, reads: 0, born: NOW, touched: NOW })
    expect(back.stars['c.json']).toEqual({ edits: 0, reads: 1, born: NOW + 2, touched: NOW })
    expect(back.constellations).toEqual([{ at: NOW, files: ['a.ts', 'b.md'] }])
  })

  test('a file named __proto__ is only a key', () => {
    const back = parseSky(JSON.parse('{"version":1,"stars":{"__proto__":{"edits":1,"reads":0,"born":1,"touched":1}},"constellations":[]}'))
    expect(Object.keys(back.stars)).toEqual(['__proto__'])
  })
})

describe('relativePath', () => {
  test('POSIX roots', () => {
    expect(relativePath('/home/me/app', '/home/me/app/src/a.ts')).toBe('src/a.ts')
    expect(relativePath('/home/me/app/', '/home/me/app/./src/../lib/b.ts')).toBe('lib/b.ts')
    expect(relativePath('/home/me/app', '/home/me/application/a.ts')).toBeUndefined()
    expect(relativePath('/home/me/app', '/home/me/other/a.ts')).toBeUndefined()
    expect(relativePath('/home/me/app', '/home/me/app/../app2/a.ts')).toBeUndefined()
    expect(relativePath('/home/me/app', '/home/me/app')).toBeUndefined()
    expect(relativePath('/home/me/App', '/home/me/app/a.ts')).toBeUndefined() // case counts off Windows
  })

  test('Windows roots, backslashes and case', () => {
    expect(relativePath('E:\\work\\app', 'E:\\work\\app\\src\\a.ts')).toBe('src/a.ts')
    expect(relativePath('E:\\work\\app', 'e:/Work/App/src/A.ts')).toBe('src/A.ts')
    expect(relativePath('E:/work/app', 'D:/work/app/a.ts')).toBeUndefined()
    expect(relativePath('E:\\work\\app', 'E:\\work\\app\\..\\other\\a.ts')).toBeUndefined()
  })

  test('relative input is taken from the root', () => {
    expect(relativePath('/home/me/app', 'src/a.ts')).toBe('src/a.ts')
    expect(relativePath('/home/me/app', './README.md')).toBe('README.md')
    expect(relativePath('/home/me/app', '../elsewhere.ts')).toBeUndefined()
  })

  test('build and dependency folders are skipped', () => {
    for (const folder of ['node_modules', '.git', 'dist', 'build', '.next', 'target', '.venv', '__pycache__']) {
      expect(relativePath('/app', `/app/pkg/${folder}/x.js`)).toBeUndefined()
    }
    expect(relativePath('/app', '/app/builder/x.js')).toBe('builder/x.js')
  })
})

describe('mergeDelta', () => {
  test('creates stars, then updates them', () => {
    const one = mergeDelta(emptySky(), delta({ 'a.ts': 1 }, { 'r.md': 2 }), NOW)
    expect(one.stars['a.ts']).toEqual({ edits: 1, reads: 0, born: NOW, touched: NOW })
    expect(one.stars['r.md']).toEqual({ edits: 0, reads: 2, born: NOW + 1, touched: NOW })
    const two = mergeDelta(one, delta({ 'a.ts': 2 }, { 'a.ts': 1, 'r.md': 1 }), NOW + 500)
    expect(two.stars['a.ts']).toEqual({ edits: 3, reads: 1, born: NOW, touched: NOW + 500 })
    expect(two.stars['r.md']).toEqual({ edits: 0, reads: 3, born: NOW + 1, touched: NOW + 500 })
    expect(one.stars['a.ts']?.edits).toBe(1) // the old sky is left as it was
    // A read of an edited file does not move when it was last edited.
    const three = mergeDelta(two, delta({}, { 'a.ts': 1 }), NOW + 900)
    expect(three.stars['a.ts']?.touched).toBe(NOW + 500)
  })

  test('new stars are born in order: edited first, then read, each alphabetical', () => {
    const sky = mergeDelta(emptySky(), delta({ 'z.ts': 1, 'b.ts': 1 }, { 'a.md': 1, 'y.md': 1 }), NOW)
    expect(['b.ts', 'z.ts', 'a.md', 'y.md'].map(path => sky.stars[path]?.born)).toEqual([NOW, NOW + 1, NOW + 2, NOW + 3])
  })

  test('a constellation forms only for two or more edited files, at most nine, the most edited first', () => {
    expect(mergeDelta(emptySky(), delta({ 'a.ts': 4 }, { 'b.ts': 1 }), NOW).constellations).toHaveLength(0)
    const pair = mergeDelta(emptySky(), delta({ 'a.ts': 1, 'b.ts': 3 }), NOW)
    expect(pair.constellations).toEqual([{ at: NOW, files: ['b.ts', 'a.ts'] }])
    const edits: Record<string, number> = {}
    for (let index = 0; index < 12; index += 1) edits[`f${String(index).padStart(2, '0')}.ts`] = index === 5 ? 9 : 1
    const big = mergeDelta(emptySky(), delta(edits), NOW)
    expect(big.constellations[0]?.files).toEqual(['f05.ts', 'f00.ts', 'f01.ts', 'f02.ts', 'f03.ts', 'f04.ts', 'f06.ts', 'f07.ts', 'f08.ts'])
  })

  test('keeps at most 400 stars, sparing constellations, and 48 constellations', () => {
    let sky = emptySky()
    for (let turn = 0; turn < 60; turn += 1) {
      sky = mergeDelta(sky, delta({ [`t${turn}/a.ts`]: 1, [`t${turn}/b.ts`]: 1 }), NOW + turn * 1000)
    }
    expect(sky.constellations).toHaveLength(MAX_CONSTELLATIONS)
    expect(sky.constellations[0]?.files[0]).toBe('t12/a.ts') // the oldest twelve went
    const reads: Record<string, number> = {}
    for (let index = 0; index < 400; index += 1) reads[`dust/${index}.md`] = 1
    sky = mergeDelta(sky, delta({}, reads), NOW + 100_000)
    expect(Object.keys(sky.stars)).toHaveLength(MAX_STARS)
    for (const figure of sky.constellations) {
      for (const file of figure.files) expect(sky.stars[file]).toBeDefined()
    }
    expect(sky.stars['t0/a.ts']?.edits).toBe(1) // edited stars outrank dust, even out of a figure
  })

  test('drops files whose stars went, and a constellation left with one', () => {
    // Every star stands in a constellation, so the dimmest of them has to go: keep/a.ts.
    let sky = mergeDelta(emptySky(), delta({ 'keep/a.ts': 1, 'keep/b.ts': 1 }), NOW)
    for (let turn = 1; turn <= 44; turn += 1) {
      const edits: Record<string, number> = {}
      for (let index = 0; index < 9; index += 1) edits[`t${turn}/${index}.ts`] = 2
      sky = mergeDelta(sky, delta(edits), NOW + turn * 1000)
    }
    expect(Object.keys(sky.stars)).toHaveLength(398)
    sky = mergeDelta(sky, delta({ 'last/a.ts': 2, 'last/b.ts': 2, 'last/c.ts': 2 }), NOW + 99_000)
    expect(Object.keys(sky.stars)).toHaveLength(MAX_STARS)
    expect(sky.stars['keep/a.ts']).toBeUndefined()
    expect(sky.stars['keep/b.ts']).toBeDefined()
    expect(sky.constellations).toHaveLength(45)
    expect(sky.constellations.some(figure => figure.files.includes('keep/b.ts'))).toBe(false)
  })

  test('the empty delta', () => {
    expect(isEmptyDelta(emptyDelta())).toBe(true)
    expect(isEmptyDelta({ ...emptyDelta(), testsPassed: true })).toBe(false)
    expect(isEmptyDelta(delta({}, { 'a.md': 1 }))).toBe(false)
  })
})

test('spectralClass by extension', () => {
  const cases: Record<string, string> = {
    'src/main.rs': 'B', 'a/b.CPP': 'B', 'x.tsx': 'A', 'x.mts': 'A', 'site/index.html': 'C', 'icon.svg': 'C',
    'README.md': 'F', 'notes.txt': 'F', 'tool.py': 'G', 'run.ps1': 'G', 'package.json': 'K', 'Cargo.lock': 'K',
    '.env': 'K', 'Makefile': 'M', 'image.png': 'M', 'dir.v2/file': 'M',
  }
  for (const [path, type] of Object.entries(cases)) expect(`${path} ${spectralClass(path)}`).toBe(`${path} ${type}`)
})

describe('spanningTree', () => {
  test('n - 1 edges that connect every point, from point 0', () => {
    const points = [0, 1, 2, 3, 4, 5, 6].map(index => ({ x: (index * 137) % 400, y: (index * 91) % 300 }))
    const edges = spanningTree(points)
    expect(edges).toHaveLength(points.length - 1)
    const reached = new Set([0])
    for (const [from, to] of edges) {
      expect(reached.has(from)).toBe(true)
      reached.add(to)
    }
    expect(reached.size).toBe(points.length)
    expect(spanningTree([{ x: 1, y: 1 }])).toEqual([])
  })

  test('the minimal tree on a known case', () => {
    // A square of side 10 with a point near one corner: the tree takes the short sides, never the diagonal.
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 1, y: 1 }]
    const edges = spanningTree(points)
    const length = edges.reduce((sum, [a, b]) => {
      const one = points[a]
      const other = points[b]
      return sum + (one && other ? Math.hypot(one.x - other.x, one.y - other.y) : 0)
    }, 0)
    expect(edges[0]).toEqual([0, 4])
    expect(Math.abs(length - (Math.SQRT2 + 2 * Math.sqrt(82) + 10))).toBeLessThan(1e-9)
  })
})

describe('joinNear', () => {
  test('cuts the tree at the reach: near points join, far ones form their own figures, a lone point stays out', () => {
    const points = [0, 100, 200, 1000, 1100, 2000].map(x => ({ x, y: 0 }))
    const { edges, groups } = joinNear(points, 150)
    expect(edges).toEqual([[0, 1], [1, 2], [3, 4]])
    expect(groups).toEqual([[0, 1, 2], [3, 4]])
  })

  test('no edge is longer than the reach', () => {
    const points = Array.from({ length: 40 }, (_, index) => ({ x: (index * 389) % 1500, y: (index * 241) % 900 }))
    const { edges } = joinNear(points)
    expect(edges.length).toBeGreaterThan(0)
    for (const [a, b] of edges) {
      const one = points[a]
      const other = points[b]
      expect(one && other ? Math.hypot(one.x - other.x, one.y - other.y) : Infinity).toBeLessThanOrEqual(REACH)
    }
  })

  test('points all within reach make one figure with every point in it', () => {
    const points = [{ x: 0, y: 0 }, { x: 50, y: 10 }, { x: 90, y: 70 }]
    const { edges, groups } = joinNear(points)
    expect(edges).toHaveLength(2)
    expect(groups).toEqual([[0, 1, 2]])
  })
})

describe('isTestCommand', () => {
  test('test runs count', () => {
    for (const command of [
      'npm test', 'npm run test', 'npm t', 'npm run test:unit', 'pnpm test', 'pnpm run test', 'yarn test', 'bun test',
      'npx vitest run', 'vitest', 'npx jest src', './node_modules/.bin/jest', 'pytest -q tests/', 'python -m pytest',
      'python3 -m unittest discover', 'go test ./...', 'cargo test --release', 'cargo nextest run', 'deno test',
      'dotnet test', 'mvn test', 'gradle test', './gradlew test', 'bundle exec rspec', 'vendor/bin/phpunit', 'mix test',
      'ctest --output-on-failure', 'make test', 'cd plugins && claude plugin test plugins/x', 'cd app; npm test 2>&1 | tail',
    ]) {
      expect(`${command}: ${isTestCommand(command)}`).toBe(`${command}: true`)
    }
  })

  test('near misses and watch runs do not', () => {
    for (const command of [
      'npm testimonial', 'npm install latest', 'pytest-cov --version', 'pytest --version', 'jest --watch', 'vitest --watchAll',
      'ls tests', 'cat test.py', 'git commit -m tested', 'npm run build', 'go build ./...', 'make', 'echo hello',
      'cargo build', 'node test.js',
    ]) {
      expect(`${command}: ${isTestCommand(command)}`).toBe(`${command}: false`)
    }
  })
})

describe('layout', () => {
  test('a star keeps its place as later stars are added', () => {
    const small = bigSky(120)
    const large = bigSky(400)
    const before = new Map(layout(small).map(star => [star.path, `${star.x},${star.y}`]))
    for (const star of layout(large)) {
      const was = before.get(star.path)
      if (was !== undefined) expect(`${star.path} ${star.x},${star.y}`).toBe(`${star.path} ${was}`)
    }
  })

  test('every star sits inside the safe box, one decimal, none within 15 units of another', () => {
    const placed = layout(bigSky(400))
    expect(placed).toHaveLength(400)
    for (const star of placed) {
      expect(star.x).toBeGreaterThanOrEqual(SAFE.left)
      expect(star.x).toBeLessThanOrEqual(SAFE.right)
      expect(star.y).toBeGreaterThanOrEqual(SAFE.top)
      expect(star.y).toBeLessThanOrEqual(SAFE.bottom)
      expect(Math.round(star.x * 10) / 10).toBe(star.x)
    }
    let closest = Infinity
    for (let one = 0; one < placed.length; one += 1) {
      for (let other = one + 1; other < placed.length; other += 1) {
        const a = placed[one]
        const b = placed[other]
        if (a && b) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y))
      }
    }
    expect(closest).toBeGreaterThanOrEqual(15)
  })

  test('files of one folder sit nearer each other than files of different top-level folders', () => {
    const placed = layout(bigSky(400))
    const top = (path: string) => (path.includes('/') ? path.slice(0, path.indexOf('/')) : '')
    let same = 0
    let sameCount = 0
    let apart = 0
    let apartCount = 0
    for (const a of placed) {
      for (const b of placed) {
        if (a.path >= b.path) continue
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const dirA = a.path.slice(0, a.path.lastIndexOf('/') + 1)
        if (dirA === b.path.slice(0, b.path.lastIndexOf('/') + 1)) {
          same += distance
          sameCount += 1
        } else if (top(a.path) !== top(b.path)) {
          apart += distance
          apartCount += 1
        }
      }
    }
    expect(same / sameCount).toBeLessThan((apart / apartCount) * 0.5)
  })
})

describe('summary', () => {
  test('an empty sky', () => {
    expect(summary(emptySky(), 'atlas')).toBe(
      'Constellation: atlas\nNo stars yet. Files Claude edits become stars; files edited in the same turn join into a constellation.',
    )
  })

  test('singulars', () => {
    const sky = mergeDelta(emptySky(), delta({ 'README.md': 1 }), NOW)
    expect(summary(sky, 'atlas')).toBe('Constellation: atlas\n1 star (1 edited).\nBrightest: README.md (1 edit).')
  })

  test('the full text', () => {
    let sky = mergeDelta(emptySky(), delta({ 'hooks/register.tsx': 30, 'hooks/scene.ts': 12 }, { 'docs/a.md': 1, 'docs/b.md': 1 }), NOW)
    sky = mergeDelta(sky, delta({ 'hooks/register.tsx': 1, 'README.md': 4, 'hooks/sky.ts': 2 }), NOW + 1)
    expect(summary(sky, 'claude-plugins')).toBe(
      [
        'Constellation: claude-plugins',
        '6 stars (4 edited, 2 read) in 2 constellations.',
        'Brightest: hooks/register.tsx (31 edits), hooks/scene.ts (12), README.md (4).',
        'Newest constellation: HOOKS, 3 stars.',
      ].join('\n'),
    )
  })

  test('a constellation of root files takes the project name', () => {
    const sky = mergeDelta(emptySky(), delta({ 'a.md': 1, 'b.json': 1 }), NOW)
    expect(summary(sky, 'atlas')).toContain('Newest constellation: ATLAS, 2 stars.')
  })
})
