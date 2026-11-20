// The window's colors around the field, taken from the shader's own: blue-slate
// surfaces a few percent apart over the near-black ground, a steel-teal accent
// between the slate and the sea, the hearth's warm amber for warnings, and a
// soft violet from the mauve. Red and green stay red and green, muted toward
// the slate. The glass is the veil the desktop app frosts its panels with over
// the field.

import type { ThemeBackdropGlass, ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'

const SURFACE = '#111419'

const mesh = makeColors({
  label: 'Mesh Glow',
  only: 'dark',
  roles: { accent: '#6e9cb0', danger: '#c46e6e', success: '#6fa588', warning: '#cb9a6a', pro: '#8f86ba' },
  dark: {
    gray: {
      anchors: {
        'surface-0': SURFACE,
        'surface-1': '#161a21',
        'surface-2': '#1b2028',
        'surface-3': '#1e232c',
        'text-primary': '#e6eaf0',
        'text-secondary': '#bac2cd',
        'text-muted': '#909aa8',
      },
    },
  },
})

/** The one palette: the field is dark at every hour. */
export const COLORS: ThemeColors = mesh.theme
/** What the design system says of the palette's contrast. */
export const PROBLEMS: readonly string[] = mesh.problems
/** How much veil sits between the field and the words: none, a light one, or the full frost. */
export type Glass = 'clear' | 'soft' | 'frosted'
export const GLASS_WORDS: readonly Glass[] = ['clear', 'soft', 'frosted']

export function glassFor(glass: Glass): ThemeBackdropGlass | false {
  if (glass === 'clear') return false
  if (glass === 'soft') return { blur: 4, tint: SURFACE, opacity: 0.28 }
  return { blur: 16, tint: SURFACE, opacity: 0.5 }
}
