// The band above the prompt: a strip of tiles, one per theme, and a line of what the picked one offers.
// Pictures on the desktop app and phones; compact text on the terminal. Paged to the width it is given.

import type { ElementTable, RenderElement, RenderSurface, Space } from 'claude-code'

import { entriesOf } from './catalog'
import type { Entry, Option } from './catalog'
import { pages, valueOf } from './plan'
import type { Tile } from './plan'
import { accentOf, thumbnailSvg } from './thumbs'
import type { Band, ThemeSettings } from '../types'

export type View = {
  band: Band
  active: string | null
  tiles: Tile[]
  pending: readonly string[]
  settings: ThemeSettings
  /** Whether none of Samarth's themes is installed, so one press can install them all. */
  canInstallOurs: boolean
}

export type Actions = {
  pick: (id: string) => void
  page: (index: number) => void
  keep: () => void
  cancel: () => void
  choose: (id: string, name: string, value: string) => void
  act: (id: string, name: string) => void
  confirm: () => void
  back: () => void
  install: (id: string) => void
  installOurs: () => void
}

export type Room = { columns: number; maxRows: number; surface: RenderSurface }

/** A picture tile's width in cells on the desktop app and phones. */
export const TILE_COLUMNS = 16
// Room the terminal strip keeps for its name, its arrows and the page count.
const TERMINAL_CHROME = 18

/**
 * The band's spacing: between parts of one thing, between things, and between rows. The terminal's is in
 * cells, as it was drawn; the desktop app and phones take their own spacing steps, so the band sits on the
 * same rhythm as the app around it.
 */
type Spacing = { near: Space; apart: Space; rows: Space }
const CELLS: Spacing = { near: 1, apart: 2, rows: 1 }
const STEPS: Spacing = { near: 'sm', apart: 'lg', rows: 'md' }

/** A text tile's width on the terminal: its mark, title and the gap after it, and its author's tag where the author changes. */
const textWidth = (tile: Tile, before: Tile | undefined) => tile.title.length + 4 + (before?.author === tile.author ? 0 : tile.author.length + 2)

/** The pages the strip splits into at this width, and the one in view: the one asked for, or the picked tile's. */
export function layout(view: View, room: Room) {
  const isPictures = room.surface !== 'terminal'
  const all = isPictures
    ? pages(view.tiles, () => TILE_COLUMNS, Math.max(TILE_COLUMNS, room.columns))
    : pages(view.tiles, textWidth, Math.max(20, room.columns - TERMINAL_CHROME))
  const holding = all.findIndex(page => page.some(tile => tile.id === view.band.picked))
  const asked = view.band.page < 0 ? Math.max(0, holding) : view.band.page
  const index = Math.min(Math.max(0, asked), all.length - 1)
  return { pages: all, index, tiles: all[index] ?? [], isPictures }
}

function arrows(ui: ElementTable, count: number, index: number, act: Actions): RenderElement[] {
  const { Button } = ui
  if (count < 2) return []
  return [
    <Button key="prev" plain dimColor label="‹" onPress={() => act.page((index - 1 + count) % count)} />,
    <Button key="next" plain dimColor label="›" onPress={() => act.page((index + 1) % count)} />,
  ]
}

/** The pages' arrows with the count between them, so the way to page and where you are sit together. */
function pager(ui: ElementTable, count: number, index: number, act: Actions): RenderElement[] {
  const { Text } = ui
  const [prev, next] = arrows(ui, count, index, act)
  if (prev === undefined || next === undefined) return []
  return [prev, <Text dimColor>{`${index + 1}/${count}`}</Text>, next]
}

function pictureTile(ui: ElementTable<'desktop'>, tile: Tile, view: View, act: Actions): RenderElement {
  const { Box, Text, Button, Svg } = ui
  const isPicked = tile.id === view.band.picked
  const isOn = tile.id === view.active
  return (
    // One column a tile wide: the picture fills it at its own shape and the title's button is stretched to the
    // same width under it, so every tile's edges line up whatever its title. The author is named once, below.
    <Box flexDirection="column" alignItems="stretch" width={TILE_COLUMNS - 1} gap="xs">
      <Svg
        source={thumbnailSvg(tile.entry.thumbnail, tile.title, { isPicked })}
        alt={tile.isGroup ? `${tile.title}, themes by ${tile.author}` : `${tile.title} by ${tile.author}`}
      />
      <Button key={`tile:${tile.id}`} plain dimColor={!isPicked} onPress={() => act.pick(tile.id)}>
        <Text bold={isPicked} dimColor={!tile.isInstalled} wrap="truncate">
          {isOn ? `✓ ${tile.title}` : tile.title}
        </Text>
      </Button>
    </Box>
  )
}

/** The terminal's tiles: a faint author tag where the author changes, then each theme's mark and title. */
function textTiles(ui: ElementTable, tiles: readonly Tile[], view: View, act: Actions): RenderElement[] {
  const { Text, Button } = ui
  return tiles.flatMap((tile, i) => {
    const isPicked = tile.id === view.band.picked
    const isOn = tile.id === view.active
    const button = (
      <Button key={`tile:${tile.id}`} plain onPress={() => act.pick(tile.id)}>
        <Text color={tile.isInstalled ? accentOf(tile.entry.thumbnail) : undefined} dimColor={!tile.isInstalled}>
          {isOn ? '✓ ' : isPicked ? '● ' : '○ '}
        </Text>
        <Text bold={isPicked} dimColor={!tile.isInstalled}>
          {tile.title}
        </Text>
      </Button>
    )
    return tiles[i - 1]?.author === tile.author ? [button] : [<Text dimColor>{tile.author}</Text>, button]
  })
}

function optionControl(ui: ElementTable, entry: Entry, option: Option, view: View, act: Actions): RenderElement {
  const { Select, Button } = ui
  if (option.kind === 'action') {
    return <Button key={`act:${entry.id}:${option.name}`} dimColor label={option.label} onPress={() => act.act(entry.id, option.name)} />
  }
  return (
    <Select
      key={`opt:${entry.id}:${option.name}`}
      label={option.label}
      value={valueOf(entry, option.name, view.settings)}
      options={option.values.map(v => ({ value: v.value, label: v.label }))}
      onSelect={value => act.choose(entry.id, option.name, value)}
    />
  )
}

/** The question a confirm step asks. */
function question(tile: Tile, action: string): string {
  if (action === 'remove') {
    return tile.isGroup || tile.entry.group !== undefined
      ? `Remove ${tile.entry.plugin} and all of its themes?`
      : `Remove ${tile.title}? What it saved goes too.`
  }
  const option = tile.entry.options.find(o => o.name === action)
  return option?.kind === 'action' ? (option.confirm ?? `${option.label}?`) : 'Go ahead?'
}

/** What the picked tile offers: its options and Remove, or Install; then Cancel and Keep. */
function detail(ui: ElementTable, view: View, act: Actions, columns: number, space: Spacing): RenderElement[] {
  const { Box, Text, Button } = ui
  const tile = view.tiles.find(t => t.id === view.band.picked)
  const confirm = view.band.confirm
  const isWaiting = tile !== undefined && view.pending.includes(tile.entry.plugin)

  let middle: RenderElement[] = []
  if (tile !== undefined && confirm !== null) {
    middle = [
      <Text>{question(tile, confirm.action)}</Text>,
      <Button key="confirm" variant="primary" label={confirm.action === 'remove' ? 'Remove' : 'Yes'} onPress={() => act.confirm()} />,
      <Button key="back" label="Back" onPress={() => act.back()} />,
    ]
  } else if (tile !== undefined && isWaiting) {
    middle = [<Text dimColor>Run /reload-plugins to finish.</Text>]
  } else if (tile !== undefined && !tile.isInstalled) {
    middle = [
      <Text dimColor>{tile.isGroup ? `not installed, ${entriesOf(tile.entry.plugin).length} themes` : 'not installed'}</Text>,
      <Button key={`install:${tile.id}`} variant="primary" label="Install" onPress={() => act.install(tile.id)} />,
    ]
  } else if (tile !== undefined) {
    middle = [
      ...tile.entry.options.map(option => optionControl(ui, tile.entry, option, view, act)),
      <Button key={`remove:${tile.id}`} dimColor label="Remove" onPress={() => act.act(tile.id, 'remove')} />,
    ]
  }

  const name =
    tile === undefined ? (
      <Text dimColor>Pick a theme to try it.</Text>
    ) : (
      <Box flexDirection="row" alignItems="center" gap={space.near}>
        <Text bold>{tile.title}</Text>
        <Text dimColor>by {tile.author}</Text>
      </Box>
    )
  const canKeep = tile !== undefined && tile.isInstalled && !tile.isGroup && confirm === null && !isWaiting
  const ends: RenderElement[] = [<Button key="cancel" role="dismiss" label="Cancel" onPress={() => act.cancel()} />]
  if (canKeep) ends.push(<Button key="keep" variant="primary" label="Keep" onPress={() => act.keep()} />)
  const note = view.band.isBusy ? 'Switching…' : view.band.note
  const noteText =
    note === null ? null : (
      <Text dimColor wrap="truncate">
        {note}
      </Text>
    )
  const right = (
    <Box flexDirection="row" alignItems="center" gap={space.near}>
      {noteText}
      {ends}
    </Box>
  )

  // Wide: one line, the theme and its controls at the left, the note, Cancel and Keep at the right.
  if (columns >= 100) {
    return [
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={space.apart}>
        <Box flexDirection="row" alignItems="center" gap={space.apart}>
          {name}
          {middle}
        </Box>
        {right}
      </Box>,
    ]
  }
  // Narrow: the theme and the note on one line, then its controls, with Cancel and Keep still at the right.
  return [
    <Box flexDirection="row" alignItems="center" gap={space.apart}>
      {name}
      {noteText}
    </Box>,
    <Box flexDirection="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" columnGap={space.apart} rowGap={space.near}>
      <Box flexDirection="row" alignItems="center" flexWrap="wrap" columnGap={space.apart} rowGap={space.near}>
        {middle}
      </Box>
      <Box flexDirection="row" alignItems="center" gap={space.near}>
        {ends}
      </Box>
    </Box>,
  ]
}

/** The whole band, sized to `room`, its rows held to `room.maxRows`. */
export function drawBand(ui: ElementTable, view: View, act: Actions, room: Room): RenderElement {
  const { Box, Text, Button } = ui
  const { pages: all, index, tiles, isPictures } = layout(view, room)
  const count = all.length
  const pageText = count > 1 ? `${index + 1}/${count}` : ''
  const install = view.canInstallOurs ? [<Button key="install-ours" dimColor label="Install all by Samarth" onPress={() => act.installOurs()} />] : []

  const space = isPictures ? STEPS : CELLS
  const rows: RenderElement[] = []
  if (isPictures) {
    const desktop = ui as ElementTable<'desktop'>
    rows.push(
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" columnGap={space.apart}>
        <Text bold>Themes</Text>
        <Box flexDirection="row" alignItems="center" gap={space.apart}>
          {install}
          <Box flexDirection="row" alignItems="center" gap={space.near}>
            {pager(ui, count, index, act)}
          </Box>
        </Box>
      </Box>,
      // A cell between tiles, in cells on every surface: the pages are counted in TILE_COLUMNS.
      <Box flexDirection="row" gap={1}>
        {tiles.map(tile => pictureTile(desktop, tile, view, act))}
      </Box>,
    )
  } else {
    const [prev, next] = arrows(ui, count, index, act)
    rows.push(
      <Box flexDirection="row" gap={2}>
        <Text bold>Themes</Text>
        {prev ?? null}
        {textTiles(ui, tiles, view, act)}
        {next ?? null}
        {pageText === '' ? null : <Text dimColor>{pageText}</Text>}
        {install}
      </Box>,
    )
  }
  rows.push(...detail(ui, view, act, room.columns, space))
  // Short of rows: the strip and the picked tile's controls stay; a desktop header goes first.
  const kept = rows.length <= room.maxRows ? rows : isPictures ? rows.slice(1, 1 + Math.max(1, room.maxRows - 1)) : rows.slice(0, Math.max(1, room.maxRows))
  return (
    <Box flexDirection="column" width={room.columns} rowGap={isPictures ? space.rows : 0}>
      {kept}
    </Box>
  )
}
