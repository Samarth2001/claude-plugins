// Draws plugins/light-leak/assets/preview.svg: the still frame exactly as the
// mod hands it to the backdrop by day, warm light seeping in at the lower left
// corner of a dark film frame.
//
//   node --experimental-strip-types scripts/assets/light-leak-preview.mts [--check]
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

const { stillSvg } = await import('../../plugins/light-leak/hooks/still.ts')

const OUT = 'plugins/light-leak/assets/preview.svg'

// A fixed size for a README; the mod's own frame fills its window.
const svg = stillSvg(false).replace('<svg ', '<svg width="1200" height="750" ') + '\n'

if (process.argv.includes('--check')) {
  if (!exists(OUT) || read(OUT) !== svg) {
    console.error(`${OUT} is stale: run node --experimental-strip-types scripts/assets/light-leak-preview.mts`)
    process.exit(1)
  }
  console.log(`${OUT} is up to date.`)
} else {
  write(OUT, svg)
  console.log(`Wrote ${OUT} (${svg.length} characters).`)
}
