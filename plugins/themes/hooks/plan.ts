// What the picker runs, worked out as plain data: the theme commands, in order, that leave one theme on.

import { CATALOG, PLUGINS, entriesOf, entryOf } from './catalog'
import type { Entry } from './catalog'
import type { ThemeSettings } from '../types'

/** One slash command the picker runs: `/<command> <args>`; whether it turns its plugin's theme off, or which theme it turns on. */
export type Run = { command: string; args: string; plugin: string; isOff: boolean; turnsOn?: string }

const offRun = (plugin: string): Run[] => {
  const entry = entriesOf(plugin)[0]
  return entry === undefined ? [] : [{ command: entry.command, args: entry.off, plugin, isOff: true }]
}

/** Turns off every lit plugin but `keep`. A theme's off clears the session's theme, so these run first. */
export function offs(lit: readonly string[], installed: readonly string[], keep?: string): Run[] {
  return PLUGINS.filter(plugin => plugin !== keep && lit.includes(plugin) && installed.includes(plugin)).flatMap(offRun)
}

/** The value an option holds: the picker's last choice, else its first value. */
export function valueOf(entry: Entry, name: string, settings: ThemeSettings): string | undefined {
  const option = entry.options.find(o => o.name === name)
  if (option === undefined || option.kind !== 'choice') return undefined
  const chosen = settings[entry.id]?.[name]
  return option.values.some(v => v.value === chosen) ? chosen : option.initial
}

/** The words that try a theme: its `on`. */
export function tryRun(entry: Entry): Run {
  return { command: entry.command, args: entry.on, plugin: entry.plugin, isOff: false, turnsOn: entry.id }
}

/** What Keep runs past the try: a choice marked `isOnKeep` (Anthropic's scope), else nothing. */
export function keepRuns(entry: Entry, settings: ThemeSettings): Run[] {
  return entry.options.flatMap(option => {
    if (option.kind !== 'choice' || option.isOnKeep !== true) return []
    const value = valueOf(entry, option.name, settings)
    const choice = option.values.find(v => v.value === value)
    return choice === undefined ? [] : [{ command: entry.command, args: choice.args, plugin: entry.plugin, isOff: false, turnsOn: entry.id }]
  })
}

/** Switches to `id`: the other lit themes off, then this one on. */
export function switchRuns(id: string, lit: readonly string[], installed: readonly string[]): Run[] {
  const entry = entryOf(id)
  if (entry === undefined) return []
  return [...offs(lit, installed, entry.plugin), tryRun(entry)]
}

/** A tile in the strip: a theme, or one tile for a plugin of several themes that is not installed. */
export type Tile = { id: string; title: string; author: string; entry: Entry; isGroup: boolean; isInstalled: boolean }

export function tilesOf(installed: readonly string[]): Tile[] {
  return PLUGINS.flatMap((plugin): Tile[] => {
    const entries = entriesOf(plugin)
    const first = entries[0]
    if (first === undefined) return []
    const isInstalled = installed.includes(plugin)
    if (!isInstalled && first.group !== undefined && entries.length > 1) {
      return [{ id: plugin, title: first.group.title, author: first.author, entry: first, isGroup: true, isInstalled }]
    }
    return entries.map(entry => ({ id: entry.id, title: entry.title, author: entry.author, entry, isGroup: false, isInstalled }))
  })
}

/** Splits tiles into pages, each no wider than `room` cells, given each tile's width after the one before it on its page. */
export function pages<T>(tiles: readonly T[], width: (tile: T, before: T | undefined) => number, room: number): T[][] {
  const out: T[][] = []
  let page: T[] = []
  let used = 0
  for (const tile of tiles) {
    let w = width(tile, page.at(-1))
    if (page.length > 0 && used + w > room) {
      out.push(page)
      page = []
      used = 0
      w = width(tile, undefined)
    }
    page.push(tile)
    used += w
  }
  if (page.length > 0) out.push(page)
  return out
}

/** The catalog theme a theme set stands for: one of ours by plugin, Anthropic's by scene. */
export function activeOf(plugin: string, scene: string | undefined): string | null {
  const entries = entriesOf(plugin)
  if (entries.length === 1) return entries[0]?.id ?? null
  return entries.find(entry => entry.id === scene)?.id ?? null
}

/** Every command the catalog drives, for the hook that keeps the picker's runs out of the transcript. */
export const COMMANDS: readonly string[] = [...new Set(CATALOG.map(entry => entry.command))]
