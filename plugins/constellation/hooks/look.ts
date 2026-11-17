// The window's colors around the sky: deep indigo surfaces, cool text, and the
// glass the desktop app frosts its panels with over the scene.

import type { ThemeBackdropGlass, ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'

const made = makeColors({
  label: 'Constellation',
  only: 'dark',
  roles: { accent: '#8fb0ff', danger: '#e9776d', success: '#79d3a1', warning: '#e6b769', pro: '#b9a0f6' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0a0f20',
        'surface-1': '#0f152a',
        'surface-2': '#141b33',
        'surface-3': '#18203a',
        'text-primary': '#e9edfb',
        'text-secondary': '#bcc5e0',
        'text-muted': '#929dc0',
      },
    },
  },
})

export const COLORS: ThemeColors = made.theme
/** What the design system says of the palette's contrast; none of it stops Desktop painting it. */
export const PROBLEMS: readonly string[] = made.problems
export const GLASS: ThemeBackdropGlass = { blur: 18, tint: '#0a0f20', opacity: 0.46 }
