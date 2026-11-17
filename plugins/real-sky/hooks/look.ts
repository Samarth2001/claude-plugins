// The window's colors for each part of the day: surfaces barely tinted by the
// sky behind them, neighbors a few percent apart, and an accent taken from the
// sun or the moon of that hour. A pale day, and dark dawn, dusk and night, each
// with the glass the desktop app frosts its panels with. Built once, when the
// module loads.

import type { ThemeBackdropGlass, ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'
import type { Phase } from './phase'

type Anchors = {
  'surface-0': string
  'surface-1': string
  'surface-2': string
  'surface-3'?: string
  'text-primary': string
  'text-secondary': string
  'text-muted': string
}
type Roles = { accent: string; danger: string; success: string; warning: string; pro: string }

export type Look = {
  colors: ThemeColors
  scheme: 'light' | 'dark'
  glass: ThemeBackdropGlass
  /** The raw anchors and roles, for drawings that paint their own colors. */
  anchors: Anchors
  roles: Roles
  /** What the design system says of the palette's contrast. */
  problems: readonly string[]
}

function look(label: string, scheme: 'light' | 'dark', anchors: Anchors, roles: Roles, opacity: number): Look {
  const made = makeColors({ label, only: scheme, roles, [scheme]: { gray: { anchors } } })
  const glass = { blur: 22, tint: anchors['surface-0'], opacity }
  return { colors: made.theme, scheme, glass, anchors, roles, problems: made.problems }
}

/** How much veil sits between the sky and the words: none, a light one, or the full frost. */
export type Glass = 'clear' | 'soft' | 'frosted'
export const GLASS_WORDS: readonly Glass[] = ['clear', 'soft', 'frosted']

export function veil(frost: ThemeBackdropGlass, glass: Glass): ThemeBackdropGlass | false {
  if (glass === 'clear') return false
  // The same soft veil as the other themes: a light blur at about a quarter, in this hour's tint.
  if (glass === 'soft') return { ...frost, blur: 4, opacity: 0.26 }
  return frost
}

export const LOOKS: Record<Phase, Look> = {
  // Blue hour warming to apricot: a cool slate, the accent the low sun.
  dawn: look(
    'Real Sky dawn',
    'dark',
    {
      'surface-0': '#17181e',
      'surface-1': '#1b1c23',
      'surface-2': '#1f2028',
      'surface-3': '#22232c',
      'text-primary': '#ebe7e3',
      'text-secondary': '#c8c2bf',
      'text-muted': '#a39d9c',
    },
    { accent: '#e2a888', danger: '#d9786e', success: '#8fbf98', warning: '#d6b36f', pro: '#aea2d4' },
    0.52,
  ),
  // Paper under a pale sky, the accent the noon sun's ochre.
  day: look(
    'Real Sky day',
    'light',
    {
      'surface-0': '#e7eaec',
      'surface-1': '#edeff1',
      'surface-2': '#f3f5f6',
      'text-primary': '#1a2129',
      'text-secondary': '#3d4752',
      'text-muted': '#55606b',
    },
    { accent: '#a8692a', danger: '#b4453b', success: '#3e7a4e', warning: '#94740f', pro: '#61519a' },
    0.58,
  ),
  // The light going: warm grey, the accent the setting sun.
  dusk: look(
    'Real Sky dusk',
    'dark',
    {
      'surface-0': '#18161b',
      'surface-1': '#1c1a20',
      'surface-2': '#201e25',
      'surface-3': '#24212a',
      'text-primary': '#eee7e1',
      'text-secondary': '#cbc1ba',
      'text-muted': '#a69c95',
    },
    { accent: '#e39566', danger: '#df6d6c', success: '#8cc49a', warning: '#d9b65e', pro: '#b39fdc' },
    0.52,
  ),
  // Ink blue, the accent moonlight.
  night: look(
    'Real Sky night',
    'dark',
    {
      'surface-0': '#0d1016',
      'surface-1': '#11141b',
      'surface-2': '#151820',
      'surface-3': '#181c24',
      'text-primary': '#e4e8ef',
      'text-secondary': '#bcc3cf',
      'text-muted': '#959dab',
    },
    { accent: '#aebfdd', danger: '#e07b72', success: '#86c49b', warning: '#d9b673', pro: '#b6a6e6' },
    0.48,
  ),
}
