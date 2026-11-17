// Draws plugins/real-sky/assets/preview.svg: the scene exactly as the mod
// builds it, at a fixed time of day, weather and moon.
//
//   node --experimental-strip-types scripts/assets/real-sky-preview.mts [--check]
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

const { buildScene } = await import('../../plugins/real-sky/hooks/scene.ts')

const OUT = 'plugins/real-sky/assets/preview.svg'

// A clear dusk at 18:12: the sun low on the right of its arc, the far skyline under an apricot horizon.
const scene = buildScene({ phase: 'dusk', progress: 0.4, weather: 'clear', moonAge: 10.5, time: { hour: 18, minute: 12 } })
// A fixed size for a README; the mod's own scene fills its window.
const svg = scene.replace('width="100%" height="100%"', 'width="1200" height="750"') + '\n'

if (process.argv.includes('--check')) {
  if (!exists(OUT) || read(OUT) !== svg) {
    console.error(`${OUT} is stale: run node --experimental-strip-types scripts/assets/real-sky-preview.mts`)
    process.exit(1)
  }
  console.log(`${OUT} is up to date.`)
} else {
  write(OUT, svg)
  console.log(`Wrote ${OUT} (${svg.length} characters).`)
}
