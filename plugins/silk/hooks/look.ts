// The window's colors, taken from the satin itself: graphite grays with a
// faint cool, blue-violet cast, a few percent apart, the way the cloth reads
// between its folds. The accent is the sheen's quiet silver-blue, and the
// other roles are muted toward it: a dusty red, a sage green, a soft amber and
// a dusk violet. The glass is the veil the desktop app frosts its panels with
// over the folds.

import type { ThemeBackdropGlass, ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'

const look = makeColors({
  label: 'Silk',
  only: 'dark',
  roles: { accent: '#8e9ab0', danger: '#c0706e', success: '#7ea68a', warning: '#c9a46c', pro: '#968bb8' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#111216',
        'surface-1': '#16171c',
        'surface-2': '#1b1c22',
        'surface-3': '#1d1e25',
        'text-primary': '#e8e9ef',
        'text-secondary': '#c2c4cf',
        'text-muted': '#9a9cab',
      },
    },
  },
})

/** The one palette: Silk is dark at every hour. */
export const COLORS: ThemeColors = look.theme
/** What the design system says of the palette's contrast. */
export const PROBLEMS: readonly string[] = look.problems
/** How much veil sits between the cloth and the words: none, a light one, or the full frost. */
export type Glass = 'clear' | 'soft' | 'frosted'
export const GLASS_WORDS: readonly Glass[] = ['clear', 'soft', 'frosted']
const TINT = '#111216'

export function glassFor(glass: Glass): ThemeBackdropGlass | false {
  if (glass === 'clear') return false
  if (glass === 'soft') return { blur: 4, tint: TINT, opacity: 0.28 }
  return { blur: 16, tint: TINT, opacity: 0.5 }
}
