// Draws plugins/constellation/assets/preview.svg: the scene exactly as the mod
// builds it, over a sample project's sky of fixed data and a fixed time.
//
//   node --experimental-strip-types scripts/assets/constellation-preview.mts [--check]
//
// With --check it writes nothing and exits 1 when the committed file is stale.

import { registerHooks } from 'node:module'

import { exists, read, write } from '../lib.mts'

// The mod's files import each other without extensions, as Claude Code reads
// them. Node wants the extension, so a bare relative import is tried as `.ts`.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context)
      throw error
    }
  },
})

const sky = await import('../../plugins/constellation/hooks/sky.ts')
const { buildScene } = await import('../../plugins/constellation/hooks/scene.ts')

const OUT = 'plugins/constellation/assets/preview.svg'
const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 10, 17, 18)

type Turn = { at: number; edits?: Record<string, number>; reads?: string[] }

// A map-viewer project over ten days, a turn per entry, oldest first. Most
// files are edited once or twice; a few carry the work.
const TURNS: Turn[] = [
  { at: NOW - 10 * DAY, reads: ['README.md', 'package.json', 'app/main.tsx', 'guide/faq.md', 'LICENSE'] },
  {
    at: NOW - 9 * DAY,
    edits: { 'guide/index.md': 2, 'guide/tiles.md': 1, 'guide/projections.md': 1, 'README.md': 1 },
    reads: ['guide/install.md', 'guide/styling.md'],
  },
  {
    at: NOW - 8 * DAY,
    edits: { 'crates/tiler.rs': 4, 'crates/simplify.rs': 2, 'crates/geom.rs': 1, 'crates/lib.rs': 1 },
    reads: ['crates/Cargo.toml', 'crates/bench.rs', 'crates/clip.rs'],
  },
  { at: NOW - 7 * DAY, edits: { 'crates/tiler.rs': 3 }, reads: ['crates/index.rs', 'crates/cache.rs'] },
  { at: NOW - 6 * DAY, edits: { 'crates/tiler.rs': 3 } },
  {
    at: NOW - 5 * DAY,
    edits: { 'tests/tiles.test.ts': 2, 'tests/geo.test.ts': 1, 'tests/projection.test.ts': 1, 'app/lib/geo.ts': 2 },
    reads: ['tests/fixtures.json', 'tests/setup.ts', 'tests/coast.json'],
  },
  { at: NOW - 4 * DAY, edits: { 'app/lib/geo.ts': 5 }, reads: ['app/lib/units.ts', 'app/lib/format.ts'] },
  {
    at: NOW - 3 * DAY,
    edits: { 'app/lib/geo.ts': 4, 'app/lib/projection.ts': 2, 'app/lib/tiles.ts': 1 },
    reads: ['app/lib/cache.ts', 'app/lib/color.ts', 'app/lib/parse.ts'],
  },
  {
    at: NOW - 2 * DAY,
    edits: { 'package.json': 1, 'vite.config.ts': 2 },
    reads: ['tsconfig.json', 'eslint.config.js', '.gitignore', 'index.html'],
  },
  {
    at: NOW - 1 * DAY,
    edits: {
      'app/components/MapView.tsx': 8, 'app/components/Legend.tsx': 1, 'app/components/Layers.tsx': 2,
      'app/components/Toolbar.tsx': 1, 'app/components/Popup.tsx': 1,
    },
    reads: ['app/components/Icon.tsx', 'app/components/Tabs.tsx', 'app/theme.ts', 'app/store.ts'],
  },
  { at: NOW - 1 * DAY + 2 * HOUR, edits: { 'app/components/MapView.tsx': 9 }, reads: ['app/hooks.ts'] },
  { at: NOW - 1 * DAY + 4 * HOUR, edits: { 'app/components/MapView.tsx': 7 } },
  {
    at: NOW - 20 * 60_000,
    edits: { 'examples/basic.ts': 2, 'examples/heatmap.ts': 1, 'examples/routes.ts': 1, 'examples/README.md': 1 },
    reads: ['examples/data.json', 'examples/style.css'],
  },
]

export function sampleSky() {
  let built = sky.emptySky()
  for (const turn of TURNS) {
    const delta = sky.emptyDelta()
    Object.assign(delta.edits, turn.edits ?? {})
    for (const path of turn.reads ?? []) delta.reads[path] = 1
    built = sky.mergeDelta(built, delta, turn.at)
  }
  return built
}

const sample = sampleSky()
const scene = buildScene({
  placed: sky.layout(sample),
  constellations: sample.constellations,
  now: NOW,
  meteor: false,
  projectName: 'atlas',
})
// A fixed size for a README; the mod's own scene fills its window.
const svg = scene.replace('width="100%" height="100%"', 'width="1200" height="750"') + '\n'

if (process.argv.includes('--check')) {
  if (!exists(OUT) || read(OUT) !== svg) {
    console.error(`${OUT} is stale: run node --experimental-strip-types scripts/assets/constellation-preview.mts`)
    process.exit(1)
  }
  console.log(`${OUT} is up to date.`)
} else {
  write(OUT, svg)
  console.log(`Wrote ${OUT} (${svg.length} characters, ${Object.keys(sample.stars).length} stars, ${sample.constellations.length} constellations).`)
}
