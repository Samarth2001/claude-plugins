// Draws plugins/silk/assets/preview.svg: the still picture exactly as the mod
// hands it to the backdrop by day, graphite satin in long folds sweeping in an
// arc from the lower left up across the top.
//
//   node --experimental-strip-types scripts/assets/silk-preview.mts [--check]
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

const { stillSvg } = await import('../../plugins/silk/hooks/still.ts')

const OUT = 'plugins/silk/assets/preview.svg'

// A fixed size for a README; the mod's own picture fills its window.
const svg = stillSvg(false).replace('<svg ', '<svg width="1200" height="750" ') + '\n'

if (process.argv.includes('--check')) {
  if (!exists(OUT) || read(OUT) !== svg) {
    console.error(`${OUT} is stale: run node --experimental-strip-types scripts/assets/silk-preview.mts`)
    process.exit(1)
  }
  console.log(`${OUT} is up to date.`)
} else {
  write(OUT, svg)
  console.log(`Wrote ${OUT} (${svg.length} characters).`)
}
