// Checks that every plugin folder, marketplace entry, manifest and changelog
// agree, and regenerates the catalog table in the root README from the
// marketplace.
//
//   node --experimental-strip-types scripts/catalog.mts           write the table
//   node --experimental-strip-types scripts/catalog.mts --check   CI: fail on drift

import { MARKETPLACE, catalogErrors, isReadmeCurrent, readJson, updateReadme } from './lib.mts'
import type { Marketplace } from './lib.mts'

const marketplace = readJson<Marketplace>(MARKETPLACE)
const errors = catalogErrors(marketplace)
for (const error of errors) console.error(`::error::${error}`)

if (process.argv.includes('--check')) {
  if (!isReadmeCurrent(marketplace)) {
    console.error('::error::The README catalog is stale: run node --experimental-strip-types scripts/catalog.mts')
    process.exit(1)
  }
  if (errors.length > 0) process.exit(1)
  console.log(`catalog is consistent: ${marketplace.plugins.length} plugin(s)`)
} else {
  updateReadme(marketplace)
  console.log('updated the README catalog')
  if (errors.length > 0) process.exit(1)
}
