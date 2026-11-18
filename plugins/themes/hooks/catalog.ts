// The themes the picker knows. Adding a theme is one entry here: the picker drives the theme's own
// slash command with the words below, and never draws or stores anything of the theme itself.

/** One value of a choice: what the picker shows, and the words after the command that set it. */
export type Choice = { value: string; label: string; args: string }

/**
 * Something the person can change from the picker.
 * `choice` is a Select; its `args` run at once, or with `isOnKeep` only as part of Keep.
 * `action` is a Button; with `confirm`, the picker asks that question first.
 */
export type Option =
  | { kind: 'choice'; name: string; label: string; values: readonly Choice[]; initial: string; isOnKeep?: boolean }
  | { kind: 'action'; name: string; label: string; args: string; confirm?: string }

/** A small picture for the tile: drawn art, or a colour swatch where the picker has no art of its own. */
export type Thumbnail = { kind: 'art'; art: 'pixel-room' } | { kind: 'swatch'; tint: string; window: 'light' | 'dark' }

export type Entry = {
  /** What `/themes <id>` takes, unique across the catalog. */
  id: string
  title: string
  /** Who built it, shown as "by <author>". */
  author: string
  /** The plugin that holds the theme, and the marketplace it installs from. */
  plugin: string
  marketplace: string
  /** The theme's own slash command, without the slash. */
  command: string
  /** The words that turn this theme on, try it, or turn it off. */
  on: string
  off: string
  /** Words that delete what the theme stored, run before it is removed; absent where it has none. */
  forget?: string
  /** One tile in place of every entry of this plugin while it is not installed. */
  group?: { title: string }
  options: readonly Option[]
  thumbnail: Thumbnail
}

const SAMARTH = { author: 'Samarth', marketplace: 'samarth' } as const

const onOff = (name: string, label: string, args: (word: 'on' | 'off') => string): Option => ({
  kind: 'choice',
  name,
  label,
  initial: 'on',
  values: [
    { value: 'on', label: 'on', args: args('on') },
    { value: 'off', label: 'off', args: args('off') },
  ],
})

/** How clear the chat sits over the scene: no veil, a light one, or the full frost. */
const GLASS: Option = {
  kind: 'choice',
  name: 'glass',
  label: 'Glass',
  initial: 'soft',
  values: ['clear', 'soft', 'frosted'].map(word => ({ value: word, label: word, args: `glass ${word}` })),
}

const OURS: readonly Entry[] = [
  {
    id: 'pixel-room',
    title: 'Pixel Room',
    ...SAMARTH,
    plugin: 'pixel-room',
    command: 'pixel-room',
    on: 'on',
    off: 'off',
    forget: 'forget',
    options: [
      GLASS,
      onOff('card', 'Card', word => `card ${word}`),
      {
        kind: 'choice',
        name: 'sound',
        label: 'Sound',
        initial: 'on',
        values: [
          { value: 'on', label: 'on', args: 'unmute' },
          { value: 'off', label: 'off', args: 'mute' },
        ],
      },
    ],
    thumbnail: { kind: 'art', art: 'pixel-room' },
  },
]

// Anthropic's theme-examples plugin: each scene by its id and title, the colour its glass is tinted, and the
// kind of window it is made for. Tried for this session only; Keep applies it with the scope chosen.
const SCENES: readonly (readonly [id: string, title: string, tint: string, window: 'light' | 'dark'])[] = [
  ['honu-lagoon', 'Honu Lagoon', '#e6fbff', 'light'],
  ['koi-mosaic', 'Koi Mosaic', '#eef8f1', 'light'],
  ['halftone-dawn', 'Halftone Dawn', '#f6ead9', 'light'],
  ['halftone-dusk', 'Halftone Dusk', '#1f2336', 'dark'],
  ['plotter-tide', 'Plotter Tide', '#f4efe4', 'light'],
  ['plotter-tide-night', 'Plotter Tide, Night', '#141a27', 'dark'],
  ['dither-dunes', 'Dither Dunes', '#f1e8d6', 'light'],
  ['dither-dunes-night', 'Dither Dunes Night', '#1c1712', 'dark'],
  ['paper-garden', 'Paper Garden', '#fbf6ec', 'light'],
  ['paper-garden-kraft', 'Paper Garden, Kraft', '#35312a', 'dark'],
  ['night-reef', 'Night Reef', '#0a1430', 'dark'],
  ['snow-pines', 'Snow Pines', '#14143a', 'dark'],
  ['braille-stars', 'Braille Stars', '#0a1430', 'dark'],
  ['teletext-clouds', 'Block Clouds', '#0d173f', 'dark'],
  ['vector-range', 'Vector Range', '#0e2f27', 'dark'],
  ['departure-board', 'Departure Board', '#1a120b', 'dark'],
  ['blueprint', 'Blueprint', '#0c2444', 'dark'],
  ['deep-water', 'Deep Water', '#062c3a', 'dark'],
  ['aurora', 'Aurora', '#14123a', 'dark'],
  ['ember', 'Ember', '#2a0d12', 'dark'],
]

const ANTHROPIC: readonly Entry[] = SCENES.map(([id, title, tint, window]) => ({
  id,
  title,
  author: 'Anthropic',
  plugin: 'theme-examples',
  marketplace: 'claude-plugins-official',
  command: 'custom-theme',
  on: `${id} session`,
  off: 'off',
  group: { title: 'Theme Examples' },
  options: [
    {
      kind: 'choice',
      name: 'scope',
      label: 'Keep for',
      initial: 'project',
      isOnKeep: true,
      values: [
        { value: 'project', label: 'this project', args: id },
        { value: 'session', label: 'this session', args: `${id} session` },
      ],
    },
  ],
  thumbnail: { kind: 'swatch', tint, window },
}))

export const CATALOG: readonly Entry[] = [...OURS, ...ANTHROPIC]

export const entryOf = (id: string | null | undefined): Entry | undefined => CATALOG.find(entry => entry.id === id)

/** Every plugin the catalog names, once, in catalog order. */
export const PLUGINS: readonly string[] = [...new Set(CATALOG.map(entry => entry.plugin))]

export const entriesOf = (plugin: string): Entry[] => CATALOG.filter(entry => entry.plugin === plugin)
