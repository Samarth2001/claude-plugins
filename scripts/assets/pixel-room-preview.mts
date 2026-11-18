// Draws plugins/pixel-room/assets/preview.svg: the scene exactly as the mod
// builds it, at night with the lamp lit and the cat asleep on the sill, the
// clock at twenty to eleven.
//
//   node --experimental-strip-types scripts/assets/pixel-room-preview.mts [--check]
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

const { buildScene, quietScene } = await import('../../plugins/pixel-room/hooks/scene.ts')


const OUT = 'plugins/pixel-room/assets/preview.svg'

const scene = buildScene(quietScene('asleep', 'night'), { hour: 22, minute: 40, second: 0 })
// A fixed size for a README; the mod's own scene fills its window.
const svg = scene.replace('width="100%" height="100%"', 'width="1200" height="750"') + '\n'

if (process.argv.includes('--check')) {
  if (!exists(OUT) || read(OUT) !== svg) {
    console.error(`${OUT} is stale: run node --experimental-strip-types scripts/assets/pixel-room-preview.mts`)
    process.exit(1)
  }
  console.log(`${OUT} is up to date.`)
} else {
  write(OUT, svg)
  console.log(`Wrote ${OUT} (${svg.length} characters).`)
}
