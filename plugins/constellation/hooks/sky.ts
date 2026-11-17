// The sky's data and the arithmetic on it: what a turn adds, how a star is
// placed, how a constellation is joined. Pure functions with no imports, so the
// scene builder and the preview script can load this file as it is.

export type Star = {
  /** Edits by Edit, Write or NotebookEdit. 0 for a file only read. */
  edits: number
  /** Reads. */
  reads: number
  /** Epoch ms first seen: fixes the star's place in the layout order. */
  born: number
  /** Epoch ms last edited, or last read where never edited. */
  touched: number
}

export type Constellation = {
  /** Epoch ms the turn ended. */
  at: number
  /** Project-relative paths of the files edited in that turn, 2 to 9. */
  files: string[]
}

export type Sky = {
  version: 1
  /** Keyed by project-relative path, with forward slashes. */
  stars: Record<string, Star>
  /** Oldest first. */
  constellations: Constellation[]
}

/** What one turn adds, gathered while it runs. */
export type Delta = {
  edits: Record<string, number>
  reads: Record<string, number>
  testsPassed: boolean
}

export type SpectralClass = 'B' | 'A' | 'C' | 'F' | 'G' | 'K' | 'M'

export type Placed = {
  path: string
  /** Picture units, one decimal. */
  x: number
  y: number
  star: Star
  class: SpectralClass
}

export type Point = { x: number; y: number }

export const MAX_STARS = 400
export const MAX_CONSTELLATIONS = 48
export const MAX_FIGURE = 9
/** How long a new star, a new line or a meteor takes to play out, in ms. */
export const REVEAL_MS = 12_000

/** The picture is 1600 by 1000; stars stay inside this box. */
export const SAFE = { left: 56, right: 1544, top: 96, bottom: 880 } as const
/** How near two stars may sit. */
export const SEPARATION = 15

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'target', '.venv', '__pycache__'])

// Records keyed by file path have no prototype, so a file named `__proto__` is just a key.
function record<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export function emptySky(): Sky {
  return { version: 1, stars: record(), constellations: [] }
}

export function emptyDelta(): Delta {
  return { edits: record(), reads: record(), testsPassed: false }
}

export function isEmptyDelta(delta: Delta): boolean {
  return Object.keys(delta.edits).length === 0 && Object.keys(delta.reads).length === 0 && !delta.testsPassed
}

/** The sky the store held, checked field by field: anything malformed is an empty sky. */
export function parseSky(value: unknown): Sky {
  if (!isObject(value) || value.version !== 1 || !isObject(value.stars) || !Array.isArray(value.constellations)) {
    return emptySky()
  }
  const sky = emptySky()
  for (const [path, star] of Object.entries(value.stars)) {
    if (path === '' || !isObject(star)) return emptySky()
    const { edits, reads, born, touched } = star
    if (!isCount(edits) || !isCount(reads) || !isCount(born) || !isCount(touched)) return emptySky()
    sky.stars[path] = { edits, reads, born, touched }
  }
  for (const figure of value.constellations) {
    if (!isObject(figure) || !isCount(figure.at) || !Array.isArray(figure.files)) return emptySky()
    const files = figure.files
    if (!files.every((file): file is string => typeof file === 'string')) return emptySky()
    sky.constellations.push({ at: figure.at, files: [...files] })
  }
  return sky
}

/** A path's leading part (`/`, `C:`, `//`) and its segments with `.` and `..` worked out. */
function split(path: string): { head: string; parts: string[] } {
  const slashed = path.replace(/\\/g, '/')
  const drive = /^[a-z]:/i.exec(slashed)
  const head = drive ? drive[0] : slashed.startsWith('//') ? '//' : slashed.startsWith('/') ? '/' : ''
  return { head, parts: slashed.slice(head.length).split('/') }
}

function resolve(parts: readonly string[]): string[] {
  const out: string[] = []
  for (const part of parts) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return out
}

/**
 * The path of `file` below `root`, with forward slashes, or undefined when it
 * lies outside the root, is the root, or passes through a build or dependency
 * folder. A relative `file` is taken from the root. A Windows root (`C:...`)
 * compares without regard to case.
 */
export function relativePath(root: string, file: string): string | undefined {
  const base = split(root)
  const target = split(file)
  const isWindows = /^[a-z]:/i.test(base.head)
  const rootParts = resolve(base.parts)
  const parts = target.head === '' ? resolve([...rootParts, ...target.parts]) : resolve(target.parts)
  const head = target.head === '' ? base.head : target.head
  const same = (a: string, b: string) => (isWindows ? a.toLowerCase() === b.toLowerCase() : a === b)
  if (!same(head, base.head) || parts.length <= rootParts.length) return undefined
  if (!rootParts.every((part, index) => same(part, parts[index] ?? ''))) return undefined
  const below = parts.slice(rootParts.length)
  if (below.some(part => IGNORED.has(part.toLowerCase()))) return undefined
  return below.join('/')
}

const byCountThenName = (counts: Record<string, number>) => (a: string, b: string) =>
  (counts[b] ?? 0) - (counts[a] ?? 0) || (a < b ? -1 : a > b ? 1 : 0)

const alphabetical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** The sky with one turn's edits and reads added, capped. */
export function mergeDelta(sky: Sky, delta: Delta, now: number): Sky {
  const stars = record<Star>()
  for (const [path, star] of Object.entries(sky.stars)) stars[path] = { ...star }

  const edited = Object.keys(delta.edits).filter(path => (delta.edits[path] ?? 0) > 0).sort(alphabetical)
  const read = Object.keys(delta.reads)
    .filter(path => (delta.reads[path] ?? 0) > 0)
    .sort(alphabetical)

  // New paths get unique, ordered birth times, so the layout order never ties.
  const fresh = [...edited, ...read.filter(path => !edited.includes(path))].filter(path => stars[path] === undefined)
  fresh.forEach((path, index) => {
    stars[path] = { edits: 0, reads: 0, born: now + index, touched: now }
  })
  for (const path of edited) {
    const star = stars[path]
    if (star === undefined) continue
    star.edits += delta.edits[path] ?? 0
    star.touched = now
  }
  for (const path of read) {
    const star = stars[path]
    if (star === undefined) continue
    star.reads += delta.reads[path] ?? 0
    if (star.edits === 0) star.touched = now
  }

  let constellations = sky.constellations.map(figure => ({ at: figure.at, files: [...figure.files] }))
  if (edited.length >= 2) {
    constellations.push({ at: now, files: [...edited].sort(byCountThenName(delta.edits)).slice(0, MAX_FIGURE) })
  }
  constellations = constellations.slice(-MAX_CONSTELLATIONS)

  const paths = Object.keys(stars)
  if (paths.length > MAX_STARS) {
    const kept = new Set(constellations.flatMap(figure => figure.files))
    const dimmest = (a: string, b: string) => {
      const one = stars[a]
      const other = stars[b]
      if (one === undefined || other === undefined) return 0
      return one.edits - other.edits || one.touched - other.touched || alphabetical(a, b)
    }
    const loose = paths.filter(path => !kept.has(path)).sort(dimmest)
    const held = paths.filter(path => kept.has(path)).sort(dimmest)
    for (const path of [...loose, ...held].slice(0, paths.length - MAX_STARS)) delete stars[path]
  }

  constellations = constellations
    .map(figure => ({ at: figure.at, files: figure.files.filter(path => stars[path] !== undefined) }))
    .filter(figure => figure.files.length >= 2)

  return { version: 1, stars, constellations }
}

const CLASSES: Record<string, SpectralClass> = {}
for (const [type, extensions] of [
  ['B', 'rs go c h cc cpp hpp zig swift kt java cs'],
  ['A', 'ts tsx js jsx mjs cjs mts cts'],
  ['C', 'html css scss sass less svg vue svelte astro'],
  ['F', 'md mdx txt rst adoc'],
  ['G', 'py rb php sh bash zsh ps1 lua pl r jl'],
  ['K', 'json jsonc yaml yml toml ini env lock xml csv'],
] as const) {
  for (const extension of extensions.split(' ')) CLASSES[extension] = type
}

/** A file's star color, by its extension: systems, typed scripts, markup, prose, scripting, data, other. */
export function spectralClass(path: string): SpectralClass {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  if (dot === -1) return 'M'
  return CLASSES[name.slice(dot + 1).toLowerCase()] ?? 'M'
}

/** FNV-1a over the text's UTF-16 units, salted, with a final mix so short keys spread well. */
export function hash(text: string, salt = 0): number {
  let h = (0x811c9dc5 ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0
  for (let index = 0; index < text.length; index += 1) {
    h ^= text.charCodeAt(index)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** A float in [0, 1) from the text and a salt. */
export function unit(text: string, salt = 0): number {
  return hash(text, salt) / 4294967296
}

const TAU = Math.PI * 2
const tenth = (value: number) => Math.round(value * 10) / 10
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
/** A value past an edge folded back inside it, so stars that overrun the box scatter rather than line up along its edge. */
const fold = (value: number, low: number, high: number) =>
  clamp(value < low ? low + (low - value) : value > high ? high - (value - high) : value, low, high)

function clampPoint(x: number, y: number): Point {
  return { x: tenth(fold(x, SAFE.left, SAFE.right)), y: tenth(fold(y, SAFE.top, SAFE.bottom)) }
}

/**
 * Where a folder's cluster sits. Top-level folders scatter about the middle,
 * some near, some far out, leaning toward the left and right: the chat column
 * covers the middle of a desktop window. Deeper folders step off their parent.
 */
function anchor(directories: readonly string[]): Point {
  const top = directories[0] ?? ''
  const even = TAU * unit(top, 1)
  const angle = even - 0.3 * Math.sin(2 * even)
  const reach = 0.38 + 0.62 * unit(top, 2)
  let x = 800 + 660 * reach * Math.cos(angle) + 120 * (unit(top, 7) - 0.5)
  let y = 470 + 360 * reach * Math.sin(angle) + 80 * (unit(top, 8) - 0.5)
  for (let depth = 2; depth <= directories.length; depth += 1) {
    const prefix = directories.slice(0, depth).join('/')
    const turn = TAU * unit(prefix, 3)
    x += (230 / depth) * Math.cos(turn)
    y += (230 / depth) * Math.sin(turn)
  }
  return { x, y }
}

/** The star's own spot, before it is moved off a neighbor: a loose disc about its folder's anchor, thicker toward the middle. */
function spot(path: string): Point {
  const center = anchor(path.split('/').slice(0, -1))
  const angle = TAU * unit(path, 4)
  const distance = 22 + 150 * Math.sqrt(unit(path, 5))
  return clampPoint(center.x + distance * Math.cos(angle), center.y + distance * Math.sin(angle))
}

/** The stars placed so far, binned by 15-unit cells so a nearness check reads nine cells, not every star. */
class Field {
  private readonly cells = new Map<string, Point[]>()

  private static key(column: number, row: number): string {
    return `${column},${row}`
  }

  add(point: Point): void {
    const key = Field.key(Math.floor(point.x / SEPARATION), Math.floor(point.y / SEPARATION))
    const cell = this.cells.get(key)
    if (cell === undefined) this.cells.set(key, [point])
    else cell.push(point)
  }

  /** The distance to the nearest star within one cell of the point, or Infinity. */
  room(point: Point): number {
    const column = Math.floor(point.x / SEPARATION)
    const row = Math.floor(point.y / SEPARATION)
    let best = Infinity
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (const other of this.cells.get(Field.key(column + dx, row + dy)) ?? []) {
          best = Math.min(best, Math.hypot(point.x - other.x, point.y - other.y))
        }
      }
    }
    return best
  }
}

/**
 * Every star's place, in birth order. A star placed too near an older one
 * steps out along a spiral of its own, 6 units further each step, so its place
 * depends only on stars born before it and the sky never reshuffles as it grows.
 */
export function layout(sky: Sky): Placed[] {
  const order = Object.entries(sky.stars).sort(
    ([a, one], [b, other]) => one.born - other.born || alphabetical(a, b),
  )
  const field = new Field()
  const out: Placed[] = []
  for (const [path, star] of order) {
    const start = spot(path)
    let point = start
    if (field.room(point) < SEPARATION) {
      const turn = TAU * unit(path, 6)
      let room = field.room(point)
      // 24 steps reach 144 units out. A crowded cluster, its room taken, keeps
      // walking the same spiral outward rather than let two stars touch.
      for (let attempt = 1; attempt <= 240; attempt += 1) {
        const angle = turn + attempt * 2.39996
        const candidate = clampPoint(start.x + 6 * attempt * Math.cos(angle), start.y + 6 * attempt * Math.sin(angle))
        const space = field.room(candidate)
        if (space > room) {
          point = candidate
          room = space
        }
        if (space >= SEPARATION) break
      }
    }
    field.add(point)
    out.push({ path, x: point.x, y: point.y, star, class: spectralClass(path) })
  }
  return out
}

/** Prim's minimum spanning tree over the points, as index pairs in the order the tree grew from point 0. */
export function spanningTree(points: readonly Point[]): Array<[number, number]> {
  const count = points.length
  if (count < 2) return []
  const inTree = new Array<boolean>(count).fill(false)
  const cost = new Array<number>(count).fill(Infinity)
  const from = new Array<number>(count).fill(0)
  const edges: Array<[number, number]> = []
  let current = 0
  inTree[0] = true
  for (let step = 1; step < count; step += 1) {
    const here = points[current]
    let next = -1
    for (let index = 0; index < count; index += 1) {
      if (inTree[index]) continue
      const there = points[index]
      if (here !== undefined && there !== undefined) {
        const distance = Math.hypot(here.x - there.x, here.y - there.y)
        if (distance < (cost[index] ?? Infinity)) {
          cost[index] = distance
          from[index] = current
        }
      }
      if (next === -1 || (cost[index] ?? Infinity) < (cost[next] ?? Infinity)) next = index
    }
    inTree[next] = true
    edges.push([from[next] ?? 0, next])
    current = next
  }
  return edges
}

/** How far apart two stars of one figure may be: past it, a turn's files form separate figures. */
export const REACH = 230

/**
 * A turn's files as compact figures: the spanning tree with every edge longer
 * than `reach` cut. Answers the edges kept, in the order the tree grew, and
 * the groups they join (each two or more points); a point left alone is in none.
 */
export function joinNear(points: readonly Point[], reach = REACH): { edges: Array<[number, number]>; groups: number[][] } {
  const edges = spanningTree(points).filter(([a, b]) => {
    const one = points[a]
    const other = points[b]
    return one !== undefined && other !== undefined && Math.hypot(one.x - other.x, one.y - other.y) <= reach
  })
  const group = points.map((_, index) => index)
  const find = (index: number): number => {
    let at = index
    while (group[at] !== at) at = group[at] ?? at
    return at
  }
  for (const [a, b] of edges) group[find(b)] = find(a)
  const groups = new Map<number, number[]>()
  points.forEach((_, index) => {
    const head = find(index)
    groups.set(head, [...(groups.get(head) ?? []), index])
  })
  return { edges, groups: [...groups.values()].filter(members => members.length >= 2) }
}

// Each runner as the words that start it. A command line counts when one of
// these runs of words appears in it as whole words, anywhere: after `cd x &&`,
// inside quotes, behind `npx`. `test*` also takes a script named `test:<name>`.
// A program given by its path counts as the program (`./node_modules/.bin/jest`
// is `jest`). A line with a `--watch` flag, `--help` or `--version` never counts.
const RUNNERS = [
  'npm test', 'npm t', 'npm run test*', 'pnpm test', 'pnpm run test*', 'yarn test*', 'yarn run test*', 'bun test',
  'bun run test*', 'vitest', 'jest', 'pytest', 'python -m pytest', 'python3 -m pytest', 'python -m unittest',
  'python3 -m unittest', 'go test', 'cargo test', 'cargo nextest', 'deno test', 'dotnet test', 'mvn test',
  'gradle test', './gradlew test', 'rspec', 'phpunit', 'mix test', 'ctest', 'make test', 'claude plugin test',
].map(runner => runner.split(' '))

const fits = (pattern: string, word: string) =>
  pattern.endsWith('*') ? word === pattern.slice(0, -1) || word.startsWith(`${pattern.slice(0, -1)}:`) : word === pattern

/** Whether a shell command line runs a test suite (see RUNNERS above). */
export function isTestCommand(command: string): boolean {
  const words = command
    .toLowerCase()
    .split(/[\s'"`;&|()<>]+/)
    .filter(word => word !== '')
  if (words.some(word => word.startsWith('--watch') || word === '--help' || word === '--version')) return false
  const names = words.map(word => (word === './gradlew' ? word : word.slice(word.lastIndexOf('/') + 1)))
  return names.some((_, start) =>
    RUNNERS.some(runner => runner.every((pattern, offset) => fits(pattern, names[start + offset] ?? ''))),
  )
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** The base name of a path. */
export function baseName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** A text cut to `limit` characters, ending in an ellipsis where it was cut. */
export function cut(text: string, limit: number): string {
  const chars = [...text]
  return chars.length <= limit ? text : `${chars.slice(0, limit - 1).join('')}…`
}

/** The folder a path sits in directly: '' at the project's root. */
export function parentOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.slice(0, slash)
}

/**
 * The folder a constellation is named for: the one most of its files sit in
 * directly, ties going to the folder of the most-edited file; '' for the root.
 */
export function namesake(files: readonly string[], stars: Readonly<Record<string, Star>>): string {
  const counts = new Map<string, number>()
  for (const file of files) counts.set(parentOf(file), (counts.get(parentOf(file)) ?? 0) + 1)
  const most = Math.max(...counts.values())
  const brightest = [...files].sort((a, b) => (stars[b]?.edits ?? 0) - (stars[a]?.edits ?? 0) || alphabetical(a, b))
  return brightest.map(parentOf).find(dir => counts.get(dir) === most) ?? ''
}

/** A constellation's name: its namesake folder's own name, or the project's for the root. Upper case, at most 22 characters. */
export function constellationName(files: readonly string[], stars: Readonly<Record<string, Star>>, projectName: string): string {
  const folder = namesake(files, stars)
  return cut((folder === '' ? projectName : baseName(folder)).toUpperCase(), 22)
}

/** What `/constellation` prints. */
export function summary(sky: Sky, projectName: string): string {
  const head = `Constellation: ${projectName}`
  const entries = Object.entries(sky.stars)
  if (entries.length === 0) {
    return `${head}\nNo stars yet. Files Claude edits become stars; files edited in the same turn join into a constellation.`
  }
  const edited = entries.filter(([, star]) => star.edits > 0)
  const read = entries.length - edited.length
  const parts = [edited.length > 0 ? `${edited.length} edited` : '', read > 0 ? `${read} read` : ''].filter(Boolean)
  const figures = sky.constellations.length
  const lines = [
    head,
    `${plural(entries.length, 'star')} (${parts.join(', ')})${figures > 0 ? ` in ${plural(figures, 'constellation')}` : ''}.`,
  ]
  const brightest = [...edited]
    .sort(([a, one], [b, other]) => other.edits - one.edits || other.touched - one.touched || alphabetical(a, b))
    .slice(0, 3)
    .map(([path, star], index) => `${path} (${index === 0 ? plural(star.edits, 'edit') : star.edits})`)
  if (brightest.length > 0) lines.push(`Brightest: ${brightest.join(', ')}.`)
  const newest = sky.constellations.at(-1)
  if (newest !== undefined) {
    const files = newest.files.filter(file => sky.stars[file] !== undefined)
    lines.push(`Newest constellation: ${constellationName(files, sky.stars, projectName)}, ${plural(files.length, 'star')}.`)
  }
  return lines.join('\n')
}
