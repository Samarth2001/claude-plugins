// The window's colors around the sheen, taken from the shader's own numbers:
// cool grays a few percent apart with the faintest lilac in them, lifted off
// the near-black ground the nacre drifts over. The accent is the pale lilac of
// the shell's inside, warnings take the copper the sheen turns on an error,
// and the rest are the nacre's other tints, muted: a rose red, a jade, a quiet
// violet. The glass is the veil the desktop app frosts its panels with over the
// sheen, tinted the color of the first surface.

import type { ThemeBackdropGlass, ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'

const SURFACE = '#111116'

const pearl = makeColors({
  label: 'Pearl',
  only: 'dark',
  roles: { accent: '#b9aed6', danger: '#d86878', success: '#7fb79c', warning: '#cf9a70', pro: '#8b81b8' },
  dark: {
    gray: {
      anchors: {
        'surface-0': SURFACE,
        'surface-1': '#16161c',
        'surface-2': '#1b1b22',
        'surface-3': '#1e1e26',
        'text-primary': '#f0eef4',
        'text-secondary': '#c4c1cd',
        'text-muted': '#9c99a8',
      },
    },
  },
})

/** The palette. */
export const COLORS: ThemeColors = pearl.theme
/** What the design system says of the palette's contrast. */
export const PROBLEMS: readonly string[] = pearl.problems
/** How much veil sits between the sheen and the words: none, a light one, or the full frost. */
export type Glass = 'clear' | 'soft' | 'frosted'
export const GLASS_WORDS: readonly Glass[] = ['clear', 'soft', 'frosted']

export function glassFor(glass: Glass): ThemeBackdropGlass | false {
  if (glass === 'clear') return false
  if (glass === 'soft') return { blur: 4, tint: SURFACE, opacity: 0.28 }
  return { blur: 16, tint: SURFACE, opacity: 0.5 }
}
