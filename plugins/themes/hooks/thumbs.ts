// Small still pictures for the picker's tiles, drawn here so the picker needs nothing of a theme but its
// command. Each is 160 by 100 with rounded corners, in the theme's own colours; no script, no animation.
// The tile draws it at its own width, so the markup's size is its shape and its largest size.

import type { Art, Thumbnail } from './catalog'

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

/** A soft round light: a radial gradient that fades from `color` at `opacity` to nothing. */
const glow = (id: string, x: number, y: number, r: number, color: string, opacity: number) =>
  `<radialGradient id="${id}" cx="${x}" cy="${y}" r="${r}" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>` +
  `<stop offset=".55" stop-color="${color}" stop-opacity="${(opacity * 0.35).toFixed(3)}"/>` +
  `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>` +
  `<rect width="${W}" height="${H}" fill="url(#${id})"/>`

/** The edges a touch darker, as every backdrop is. */
const vignette = (id: string, strength: number) =>
  `<radialGradient id="${id}" cx="80" cy="46" r="105" gradientUnits="userSpaceOnUse">` +
  `<stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${strength}"/></radialGradient>` +
  `<rect width="${W}" height="${H}" fill="url(#${id})"/>`

/** Mesh Glow: deep slate, teal and plum fields over near-black, a faint warm light at the foot. */
function meshGlow(ring: Ring): string {
  return frame(
    `<rect width="${W}" height="${H}" fill="#0b0c0f"/>` +
      glow('mg-a', 34, 22, 92, '#22364f', 0.95) +
      glow('mg-b', 138, 16, 78, '#163a3c', 0.9) +
      glow('mg-c', 128, 96, 80, '#30283c', 0.9) +
      glow('mg-d', 80, 108, 46, '#d99973', 0.16) +
      vignette('mg-v', 0.35),
    'Deep slate, teal and plum fields drifting over near-black',
    ring,
  )
}

/** Light Leak: warm light seeping in at the lower left of a dark film frame, a faint wash at the right. */
function lightLeak(ring: Ring): string {
  return frame(
    `<rect width="${W}" height="${H}" fill="#0c0a09"/>` +
      glow('ll-a', -8, 108, 132, '#c56d3c', 0.78) +
      glow('ll-b', 4, 100, 40, '#f0c49a', 0.22) +
      `<linearGradient id="ll-r" x1="1" y1="0" x2=".55" y2="0"><stop offset="0" stop-color="#b0623a" stop-opacity=".3"/><stop offset="1" stop-color="#b0623a" stop-opacity="0"/></linearGradient>` +
      `<rect width="${W}" height="${H}" fill="url(#ll-r)"/>` +
      glow('ll-c', 82, 106, 42, '#b86a40', 0.14) +
      vignette('ll-v', 0.3),
    'Warm light seeping into a dark film frame from the lower left',
    ring,
  )
}

/** Silk: graphite satin in one broad fold arcing up from the lower left across the top, a softer one inside it. */
function silk(ring: Ring): string {
  // Each fold is a ring of light around a far centre: a soft band that bends, shaded across its width like cloth.
  const fold = (id: string, r: number, from: number, to: number, light: string, opacity: number) =>
    `<radialGradient id="${id}" cx="150" cy="128" r="${r}" gradientUnits="userSpaceOnUse">` +
    `<stop offset="${from}" stop-color="${light}" stop-opacity="0"/>` +
    `<stop offset="${((from + to) / 2).toFixed(3)}" stop-color="${light}" stop-opacity="${opacity}"/>` +
    `<stop offset="${to}" stop-color="${light}" stop-opacity="0"/></radialGradient>` +
    `<rect width="${W}" height="${H}" fill="url(#${id})"/>`
  return frame(
    `<rect width="${W}" height="${H}" fill="#0c0c10"/>` +
      fold('sk-a', 150, 0.62, 0.94, '#3a3d4a', 0.95) +
      fold('sk-b', 150, 0.72, 0.84, '#8f98ab', 0.16) +
      fold('sk-c', 150, 0.34, 0.56, '#262833', 0.8) +
      glow('sk-w', 80, 108, 40, '#d9a680', 0.07) +
      vignette('sk-v', 0.4),
    'Graphite satin in one broad, soft fold',
    ring,
  )
}

/** Pearl: soft nacre patches, sage, lilac, rose and pale blue, blended over near-black. */
function pearl(ring: Ring): string {
  return frame(
    `<rect width="${W}" height="${H}" fill="#0b0b0e"/>` +
      glow('pl-a', 30, 76, 66, '#8fa596', 0.3) +
      glow('pl-b', 122, 26, 70, '#a497b8', 0.3) +
      glow('pl-c', 142, 88, 60, '#b8999c', 0.24) +
      glow('pl-d', 56, 12, 58, '#93a6b8', 0.22) +
      vignette('pl-v', 0.35),
    'A muted pearly sheen in soft patches over near-black',
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
  const lift = window === 'dark' ? mix(tint, '#ffffff', 0.18) : mix(tint, '#ffffff', 0.5)
  const ink = window === 'dark' ? '#ffffff' : '#20242c'
  // The scene is its own plugin's to draw: the tile shows its glass colour, lit softly from one corner, with
  // a faint line of chat and the prompt box over it.
  const id = `sw${tint.slice(1)}`
  return frame(
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${deep}"/></linearGradient>` +
      `<rect width="${W}" height="${H}" fill="url(#${id})"/>` +
      glow(`${id}l`, 132, 10, 90, lift, 0.55) +
      `<g fill="${ink}" opacity="${window === 'dark' ? 0.09 : 0.08}"><rect x="40" y="40" width="64" height="5" rx="2.5"/><rect x="40" y="52" width="46" height="5" rx="2.5"/><rect x="28" y="76" width="104" height="12" rx="6"/></g>`,
    `${title}: a ${window} theme`,
    { ...ring, isLight: window === 'light' },
  )
}

const ART: Record<Art, (ring: Ring) => string> = { 'pixel-room': pixelRoom, 'mesh-glow': meshGlow, 'light-leak': lightLeak, silk, pearl }
const ACCENT: Record<Art, string> = { 'pixel-room': '#f4b860', 'mesh-glow': '#86a8cc', 'light-leak': '#d48f5e', silk: '#a2acbd', pearl: '#b7acc8' }

/** The tile's picture as one SVG document. */
export function thumbnailSvg(thumbnail: Thumbnail, title: string, ring: Ring = { isPicked: false }): string {
  if (thumbnail.kind === 'swatch') return swatch(thumbnail.tint, thumbnail.window, title, ring)
  return ART[thumbnail.art](ring)
}

/** One colour that stands for the theme, for the terminal's dot. */
export function accentOf(thumbnail: Thumbnail): string {
  if (thumbnail.kind === 'swatch') return thumbnail.window === 'dark' ? mix(thumbnail.tint, '#ffffff', 0.45) : mix(thumbnail.tint, '#6b6355', 0.45)
  return ACCENT[thumbnail.art]
}
