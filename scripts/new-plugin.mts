// Scaffolds plugins/<name>/ from templates/, adds its marketplace entry and
// regenerates the README catalog.
//
//   node --experimental-strip-types scripts/new-plugin.mts <name> [options]
//
//   --with <list>          components, comma separated: skill, agent, hooks, mcp, mod (default: skill)
//   --description <text>   one line for the manifest, the marketplace and the README
//   --category <text>      catalog type (default: from the first component)
//   --display-name <text>  name shown in the UI (default: <name> in title case)

import { parseArgs } from 'node:util'

import { MARKETPLACE, exists, read, readJson, updateReadme, write, writeJson } from './lib.mts'
import type { Marketplace } from './lib.mts'

const COMPONENTS = {
  skill: { category: 'skills', line: (n: string) => `- Skill \`/${n}:${n}\`: TODO` },
  agent: { category: 'agents', line: (n: string) => `- Subagent \`${n}:${n}\`: TODO` },
  hooks: { category: 'hooks', line: () => '- Hooks in `hooks/hooks.json`: TODO' },
  mcp: { category: 'mcp', line: () => '- MCP servers in `.mcp.json`: TODO' },
  mod: { category: 'mods', line: (n: string) => `- A mod with the command \`/${n}\`: TODO` },
} as const
type Component = keyof typeof COMPONENTS

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    with: { type: 'string', default: 'skill' },
    description: { type: 'string', default: 'TODO: one line on what it does' },
    category: { type: 'string' },
    'display-name': { type: 'string' },
  },
})

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const name = positionals[0] ?? fail('usage: scripts/new-plugin.mts <name> [--with skill,agent,hooks,mcp,mod] [--description ...]')
if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) fail(`"${name}" is not kebab-case`)
// claude plugin validate refuses names that pass as Anthropic's own.
if (/^(claude|anthropics?|cc-plugin)(-|$)/.test(name) || name === 'claude-code') fail(`"${name}" is reserved by Claude Code`)

const dir = `plugins/${name}`
if (exists(dir)) fail(`${dir}/ already exists`)

const components = values.with.split(',').map(c => c.trim()).filter(Boolean)
for (const c of components) if (!(c in COMPONENTS)) fail(`unknown component "${c}"; use ${Object.keys(COMPONENTS).join(', ')}`)
const chosen = components as Component[]
if (chosen.length === 0) fail('--with needs at least one component')

const marketplace = readJson<Marketplace>(MARKETPLACE)
if (marketplace.plugins.some(p => p.name === name)) fail(`${name} is already in ${MARKETPLACE}`)

const displayName = values['display-name'] ?? name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
const description = values.description.replace(/\.$/, '')
const category = values.category ?? COMPONENTS[chosen[0]].category
const repo = 'https://github.com/Samarth2001/claude-plugins'

const vars: Record<string, string> = {
  name,
  displayName,
  description,
  date: new Date().toISOString().slice(0, 10),
  components: chosen.map(c => COMPONENTS[c].line(name)).join('\n'),
}
const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? fail(`no value for {{${key}}}`))

const emit = (from: string, to: string) => write(`${dir}/${to}`, fill(read(`templates/${from}`)))

const manifest: Record<string, unknown> = {
  name,
  displayName,
  version: '0.1.0',
  description,
  author: marketplace.owner,
  homepage: `${repo}/tree/main/${dir}`,
  repository: repo,
  license: 'MIT',
  keywords: [],
}

emit('plugin/README.md', 'README.md')
emit('plugin/CHANGELOG.md', 'CHANGELOG.md')
if (chosen.includes('skill')) emit('skill/SKILL.md', `skills/${name}/SKILL.md`)
if (chosen.includes('agent')) emit('agent/agent.md', `agents/${name}.md`)
if (chosen.includes('mcp')) writeJson(`${dir}/.mcp.json`, { mcpServers: {} })
if (chosen.includes('mod')) {
  emit('mod/register.ts', 'hooks/register.ts')
  emit('mod/register.test.ts', 'hooks/register.test.ts')
  write(`${dir}/tsconfig.json`, '{ "extends": "./.claude-plugin/types/tsconfig.json" }\n')
}
// A mod and settings hooks share hooks/hooks.json: `modules` for the mod,
// `hooks` for the event map.
if (chosen.includes('mod') || chosen.includes('hooks')) {
  const hooks: Record<string, unknown> = {}
  if (chosen.includes('mod')) hooks.modules = ['./register.ts']
  if (chosen.includes('hooks')) hooks.hooks = {}
  writeJson(`${dir}/hooks/hooks.json`, hooks)
}
writeJson(`${dir}/.claude-plugin/plugin.json`, manifest)

marketplace.plugins.push({ name, source: `./${dir}`, description, category, tags: [...chosen] })
writeJson(MARKETPLACE, marketplace)
updateReadme(marketplace)

console.log(`Created ${dir}/ (${chosen.join(', ')}), added it to ${MARKETPLACE} and the README catalog.

Next:
  1. Fill in the TODOs: grep -rn TODO ${dir}
  2. claude plugin validate ${dir}${chosen.includes('mod') ? `\n     claude plugin test ${dir}` : ''}
  3. claude --plugin-dir ${dir}`)
