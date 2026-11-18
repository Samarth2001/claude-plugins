// Small still pictures for the picker's tiles, drawn here so the picker needs nothing of a theme but its
// command. Each is 160 by 100 with rounded corners, in the theme's own colours; no script, no animation.

import type { Thumbnail } from './catalog'

const W = 160
const H = 100

/** A fixed scatter, the same at every draw: a tile never flickers between redraws. */
function scatter(count: number, seed: number): [number, number, number][] {
  let s = seed
  const next = () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
  return Array.from({ length: count }, () => [Math.round(next() * W), Math.round(next() * H * 0.92), next()])
}

/** The tile's ring: the picked tile is drawn with an accent edge, the rest with a hairline that suits the picture. */
export type Ring = { isPicked: boolean; isLight?: boolean }

const PICKED = '#d97757'

const frame = (body: string, label: string, ring: Ring) => {
  const edge = ring.isPicked
    ? `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="7.5" fill="none" stroke="${PICKED}" stroke-width="3"/>`
    : `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="8.5" fill="none" stroke="${ring.isLight === true ? '#000' : '#fff'}" stroke-opacity=".12"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${label}">` +
    `<defs><clipPath id="r"><rect width="${W}" height="${H}" rx="9"/></clipPath></defs>` +
    `<g clip-path="url(#r)">${body}</g>${edge}</svg>`
  )
}

function pixelRoom(ring: Ring): string {
  // Built on a grid of 4-unit pixels, as the room is.
  const px = (x: number, y: number, w: number, h: number, fill: string, opacity = 1) =>
    `<rect x="${x * 4}" y="${y * 4}" width="${w * 4}" height="${h * 4}" fill="${fill}"${opacity === 1 ? '' : ` opacity="${opacity}"`}/>`
  const rain = scatter(14, 3)
    .filter(([x, y]) => x > 36 && x < 120 && y > 20 && y < 70)
    .map(([x, y]) => px(Math.floor(x / 4), Math.floor(y / 4), 0.25, 1, '#b8c8e2', 0.6))
    .join('')
  const city = [
    [10, 16, 3, 6],
    [13, 14, 4, 8],
    [18, 17, 3, 5],
    [22, 15, 4, 7],
    [26, 18, 3, 4],
  ]
    .map(([x = 0, y = 0, w = 0, h = 0]) => px(x, y, w, h, '#1b1828'))
    .join('')
  return frame(
    px(0, 0, 40, 25, '#2e2240') +
      px(8, 4, 24, 18, '#46344f') +
      px(9, 5, 22, 16, '#11101c') +
      px(9, 14, 22, 7, '#33456a', 0.75) +
      city +
      px(14, 18, 1, 1, '#f4b860') +
      px(24, 17, 1, 1, '#f4b860') +
      rain +
      px(19, 5, 1, 16, '#46344f') +
      px(9, 12, 22, 1, '#46344f') +
      px(0, 22, 40, 3, '#4f2a22') +
      px(33, 15, 3, 1, '#f3e2c0') +
      px(34, 16, 1, 6, '#9a7184') +
      px(32, 14, 5, 1, '#f4b860', 0.85),
    'A pixel window at night with rain, a city and a lamp',
    ring,
  )
}

/** Mixes a hex colour toward another by `t`, for the swatch's quiet gradient. */
function mix(a: string, b: string, t: number): string {
  const parse = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16))
  const [x, y] = [parse(a), parse(b)]
  return `#${x.map((v, i) => Math.round(v + ((y[i] ?? v) - v) * t).toString(16).padStart(2, '0')).join('')}`
}

function swatch(tint: string, window: 'light' | 'dark', title: string, ring: Ring): string {
  const deep = window === 'dark' ? mix(tint, '#000000', 0.35) : mix(tint, '#8a8170', 0.35)
  const ink = window === 'dark' ? '#ffffff' : '#20242c'
  // Two letters of the name stand in for the scene, which only its own plugin draws.
  const letters = title
    .split(/[\s,]+/)
    .filter(word => word !== '')
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() ?? '')
    .join('')
  return frame(
    `<linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${deep}"/></linearGradient>` +
      `<rect width="${W}" height="${H}" fill="url(#w)"/>` +
      `<g fill="${ink}" opacity="${window === 'dark' ? 0.09 : 0.08}"><rect x="12" y="14" width="64" height="7" rx="3"/><rect x="12" y="74" width="136" height="12" rx="4"/></g>` +
      `<text x="148" y="62" text-anchor="end" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="34" letter-spacing="2" fill="${ink}" opacity="${window === 'dark' ? 0.22 : 0.2}">${letters}</text>`,
    `${title}: a ${window} theme`,
    { ...ring, isLight: window === 'light' },
  )
}

/** The tile's picture as one SVG document. */
export function thumbnailSvg(thumbnail: Thumbnail, title: string, ring: Ring = { isPicked: false }): string {
  if (thumbnail.kind === 'swatch') return swatch(thumbnail.tint, thumbnail.window, title, ring)
  return pixelRoom(ring)
}

/** One colour that stands for the theme, for the terminal's dot. */
export function accentOf(thumbnail: Thumbnail): string {
  if (thumbnail.kind === 'swatch') return thumbnail.window === 'dark' ? mix(thumbnail.tint, '#ffffff', 0.45) : mix(thumbnail.tint, '#6b6355', 0.45)
  return '#f4b860'
}
