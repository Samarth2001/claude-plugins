// The room's colors, defined once. Every pixel of the backdrop and the card,
// and the seeds of the app's own colors, come from this list.

export const PAL = {
  ink: '#0e0a14',
  night: '#171120',
  plum: '#211830',
  aubergine: '#2e2240',
  mauve: '#46344f',
  dusk: '#67506a',
  rose: '#9a7184',
  cream: '#f3e2c0',
  amber: '#f4b860',
  ember: '#df8a45',
  rust: '#a65232',
  umber: '#4f2a22',
  leaf: '#7fa862',
  moss: '#3d6648',
  sea: '#2a3a62',
  steel: '#7088b6',
  mist: '#b8c8e2',
} as const

export type Ink = keyof typeof PAL
