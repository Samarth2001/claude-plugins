// Shared helpers for the repo scripts: reading and writing the marketplace,
// and the catalog checks and README table that CI keeps in sync with it.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'

export const ROOT = new URL('../', import.meta.url)
export const MARKETPLACE = '.claude-plugin/marketplace.json'
const README = 'README.md'
const START = '<!-- catalog:start -->'
const END = '<!-- catalog:end -->'

export type Entry = {
  name: string
  source: string | { source: string }
  description?: string
  displayName?: string
  category?: string
  tags?: string[]
  version?: string
}
export type Marketplace = { name: string; owner: { name: string; url?: string }; plugins: Entry[] }
export type Manifest = { name: string; displayName?: string; version?: string; description?: string }

export const path = (p: string) => new URL(p, ROOT)
export const exists = (p: string) => existsSync(path(p))
export const read = (p: string) => readFileSync(path(p), 'utf8')
export function write(p: string, text: string): void {
  mkdirSync(new URL('./', path(p)), { recursive: true })
  writeFileSync(path(p), text)
}
export const readJson = <T,>(p: string): T => JSON.parse(read(p))
export const writeJson = (p: string, value: unknown) => write(p, formatJson(value) + '\n')

// JSON.stringify with two-space indents, except that an array or object that
// fits on one line and holds no nested array or object stays on one line, the
// way the manifests in this repo are written by hand.
export function formatJson(value: unknown, indent = ''): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  const isArray = Array.isArray(value)
  const items = isArray
    ? (value as unknown[]).map(v => [undefined, v] as const)
    : Object.entries(value as Record<string, unknown>)
  const [open, close] = isArray ? ['[', ']'] : ['{', '}']
  if (items.length === 0) return open + close
  const key = (k: string | undefined) => (k === undefined ? '' : `${JSON.stringify(k)}: `)
  const isFlat = items.every(([, v]) => v === null || typeof v !== 'object')
  if (isFlat) {
    const inner = items.map(([k, v]) => key(k) + JSON.stringify(v)).join(', ')
    const line = isArray ? `[${inner}]` : `{ ${inner} }`
    if (indent.length + line.length <= 100) return line
  }
  const next = indent + '  '
  const lines = items.map(([k, v]) => next + key(k) + formatJson(v, next))
  return `${open}\n${lines.join(',\n')}\n${indent}${close}`
}

export const pluginDirs = () =>
  readdirSync(path('plugins/'), { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()

// Every way the catalog can drift: a plugin folder without an entry, an entry
// without a folder, mismatched names, or a release without its changelog.
export function catalogErrors(marketplace: Marketplace): string[] {
  const errors: string[] = []
  const dirs = new Set(pluginDirs())
  const listed = new Set<string>()

  for (const entry of marketplace.plugins) {
    const { name } = entry
    if (typeof entry.source !== 'string') continue // hosted elsewhere
    listed.add(name)
    const dir = `plugins/${name}`
    if (entry.source !== `./${dir}`) errors.push(`${name}: source should be "./${dir}", not "${entry.source}"`)
    if (!dirs.has(name)) {
      errors.push(`${name}: listed in ${MARKETPLACE} but ${dir}/ does not exist`)
      continue
    }
    if (entry.version !== undefined) errors.push(`${name}: remove "version" from the marketplace entry; plugin.json holds it`)
    if (!entry.description) errors.push(`${name}: the marketplace entry needs a "description"`)
    if (!entry.category) errors.push(`${name}: the marketplace entry needs a "category"`)

    const manifestPath = `${dir}/.claude-plugin/plugin.json`
    if (!exists(manifestPath)) {
      errors.push(`${name}: ${manifestPath} is missing`)
      continue
    }
    const manifest = readJson<Manifest>(manifestPath)
    if (manifest.name !== name) errors.push(`${name}: plugin.json name is "${manifest.name}"; it must match the entry and folder`)
    if (!manifest.version) errors.push(`${name}: plugin.json needs a "version"`)
    if (!exists(`${dir}/README.md`)) errors.push(`${name}: ${dir}/README.md is missing`)
    if (!exists(`${dir}/CHANGELOG.md`)) {
      errors.push(`${name}: ${dir}/CHANGELOG.md is missing`)
    } else if (manifest.version && !read(`${dir}/CHANGELOG.md`).includes(`## [${manifest.version}]`)) {
      errors.push(`${name}: ${dir}/CHANGELOG.md has no "## [${manifest.version}]" section`)
    }
  }

  for (const dir of dirs) {
    if (!listed.has(dir)) errors.push(`plugins/${dir}/ has no entry in ${MARKETPLACE}`)
  }
  return errors
}

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')

export function catalogTable(marketplace: Marketplace): string {
  if (marketplace.plugins.length === 0) return 'Nothing published yet.'
  const rows = marketplace.plugins.map(entry => {
    const local = typeof entry.source === 'string'
    const manifestPath = `plugins/${entry.name}/.claude-plugin/plugin.json`
    const manifest = local && exists(manifestPath) ? readJson<Manifest>(manifestPath) : undefined
    const title = entry.displayName ?? manifest?.displayName ?? entry.name
    const link = local ? `[${title}](plugins/${entry.name})` : title
    const description = entry.description ?? manifest?.description ?? ''
    return `| ${link} | \`${entry.name}\` | ${entry.category ?? ''} | ${cell(description)} |`
  })
  return ['| Plugin | Install id | Type | What it does |', '| --- | --- | --- | --- |', ...rows].join('\n')
}

// The README with its catalog table replaced, or null when it has no markers.
export function renderReadme(marketplace: Marketplace): string | null {
  const readme = read(README)
  const start = readme.indexOf(START)
  const end = readme.indexOf(END)
  if (start === -1 || end < start) return null
  return `${readme.slice(0, start + START.length)}\n${catalogTable(marketplace)}\n${readme.slice(end)}`
}

export function updateReadme(marketplace: Marketplace): void {
  const next = renderReadme(marketplace)
  if (next === null) throw new Error(`${README} has no ${START} ... ${END} markers`)
  write(README, next)
}

export const isReadmeCurrent = (marketplace: Marketplace) => renderReadme(marketplace) === read(README)
