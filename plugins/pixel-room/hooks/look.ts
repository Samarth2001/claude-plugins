// The window's colors around the room, taken from the room's own palette:
// muted plum-and-ink surfaces a few percent apart, lamp amber for the accent,
// the cat's orange for warnings and the plant's green for success. By day the
// grays lean cool, like the light off the rain; under the lamp they lean warm
// and the words turn the color of old paper. The glass is the veil the desktop
// app frosts its panels with over the scene.

import type { ThemeBackdropGlass, ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'
import { PAL } from './palette'

const ROLES = { accent: PAL.amber, danger: PAL.rust, success: PAL.leaf, warning: PAL.ember, pro: PAL.steel }

const day = makeColors({
  label: 'Pixel Room',
  only: 'dark',
  roles: ROLES,
  dark: {
    gray: {
      anchors: {
        'surface-0': '#16121f',
        'surface-1': '#1b1626',
        'surface-2': '#211b2d',
        'surface-3': '#221c2e',
        'text-primary': '#ebe6f2',
        'text-secondary': '#c6bed6',
        'text-muted': '#9f96b2',
      },
    },
  },
})

const lamplight = makeColors({
  label: 'Pixel Room Lamplight',
  only: 'dark',
  roles: ROLES,
  dark: {
    gray: {
      anchors: {
        'surface-0': '#18121d',
        'surface-1': '#1e1723',
        'surface-2': '#241c29',
        'surface-3': '#251d2a',
        'text-primary': PAL.cream,
        'text-secondary': '#d5c4b0',
        'text-muted': '#ab9a8c',
      },
    },
  },
})

/** The day palette, and the warmer one while the lamp is on. */
export const COLORS: { day: ThemeColors; lamplight: ThemeColors } = { day: day.theme, lamplight: lamplight.theme }
/** What the design system says of each palette's contrast. */
export const PROBLEMS: { day: readonly string[]; lamplight: readonly string[] } = {
  day: day.problems,
  lamplight: lamplight.problems,
}
export const GLASS: { day: ThemeBackdropGlass; lamplight: ThemeBackdropGlass } = {
  day: { blur: 16, tint: '#16121f', opacity: 0.5 },
  lamplight: { blur: 16, tint: '#18121d', opacity: 0.5 },
}
