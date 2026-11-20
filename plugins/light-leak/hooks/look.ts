// The window's colors, taken from the frame behind it: brown-black grays a few
// percent apart, like the base of a strip of film, and words the colour of a
// warm print. The accent is the leak's own amber, softened; warnings take a
// deeper ochre, errors the rose the light turns on a failed call, success a
// muted sage and pro a calm mauve. The glass is the veil the desktop app frosts
// its panels with over the light.

import type { ThemeBackdropGlass, ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'

const SURFACE = '#151210'

const leak = makeColors({
  label: 'Light Leak',
  only: 'dark',
  roles: { accent: '#c8905e', danger: '#c4606a', success: '#8aa37f', warning: '#b8862b', pro: '#957ea0' },
  dark: {
    gray: {
      anchors: {
        'surface-0': SURFACE,
        'surface-1': '#1a1714',
        'surface-2': '#201c18',
        'surface-3': '#221e1a',
        'text-primary': '#ede6de',
        'text-secondary': '#c9bfb4',
        'text-muted': '#a39689',
      },
    },
  },
})

/** The one palette: Light Leak is dark at every hour. */
export const COLORS: ThemeColors = leak.theme
/** What the design system says of the palette's contrast. */
export const PROBLEMS: readonly string[] = leak.problems
/** How much veil sits between the light and the words: none, a light one, or the full frost. */
export type Glass = 'clear' | 'soft' | 'frosted'
export const GLASS_WORDS: readonly Glass[] = ['clear', 'soft', 'frosted']

export function glassFor(glass: Glass): ThemeBackdropGlass | false {
  if (glass === 'clear') return false
  if (glass === 'soft') return { blur: 4, tint: SURFACE, opacity: 0.28 }
  return { blur: 16, tint: SURFACE, opacity: 0.5 }
}
