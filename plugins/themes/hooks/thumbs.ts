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

function constellation(ring: Ring): string {
  const dust = scatter(46, 7)
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${(0.35 + r * 0.5).toFixed(2)}" fill="#dfe7ff" opacity="${(0.25 + r * 0.5).toFixed(2)}"/>`)
    .join('')
  const figure: [number, number][] = [
    [34, 22],
    [30, 52],
    [62, 72],
    [92, 72],
  ]
  const second: [number, number][] = [
    [112, 46],
    [138, 80],
  ]
  const line = (points: [number, number][]) =>
    `<polyline points="${points.map(p => p.join(',')).join(' ')}" fill="none" stroke="#c9d4ff" stroke-opacity=".45" stroke-width=".7"/>`
  const stars = [...figure, ...second].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#fff"/>`).join('')
  return frame(
    `<rect width="${W}" height="${H}" fill="#0a0d1f"/>` +
      `<radialGradient id="g" cx=".9" cy="1" r=".7"><stop offset="0" stop-color="#2b2f72" stop-opacity=".55"/><stop offset="1" stop-color="#0a0d1f" stop-opacity="0"/></radialGradient>` +
      `<rect width="${W}" height="${H}" fill="url(#g)"/>${dust}${line(figure)}${line(second)}${stars}` +
      `<circle cx="138" cy="80" r="4.5" fill="#93a6ff" opacity=".35"/>`,
    'A night sky with two small constellations',
    ring,
  )
}

function realSky(ring: Ring): string {
  return frame(
    `<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34405e"/><stop offset=".6" stop-color="#5c6585"/><stop offset="1" stop-color="#8f7a8c"/></linearGradient>` +
      `<rect width="${W}" height="${H}" fill="url(#s)"/>` +
      `<path d="M30 104 Q 70 30 168 22" fill="none" stroke="#e8ecf6" stroke-opacity=".7" stroke-width=".8"/>` +
      `<g stroke="#ece7df" stroke-linecap="round" opacity=".35"><path d="M-4 40 H74" stroke-width="2.2"/><path d="M26 45 H102" stroke-width="1.4"/><path d="M52 70 H140" stroke-width="1.8"/></g>` +
      `<circle cx="125" cy="27" r="3.2" fill="#ffd9b8"/><circle cx="125" cy="27" r="8" fill="#ffd9b8" opacity=".18"/>` +
      `<rect x="12" y="12" width="10" height="1" fill="#e8ecf6" opacity=".6"/><rect x="12" y="17" width="26" height="1.6" fill="#e8ecf6" opacity=".45"/>`,
    'A dusk sky with a hairline arc and a low sun',
    ring,
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
  if (thumbnail.art === 'constellation') return constellation(ring)
  if (thumbnail.art === 'real-sky') return realSky(ring)
  return pixelRoom(ring)
}

/** One colour that stands for the theme, for the terminal's dot. */
export function accentOf(thumbnail: Thumbnail): string {
  if (thumbnail.kind === 'swatch') return thumbnail.window === 'dark' ? mix(thumbnail.tint, '#ffffff', 0.45) : mix(thumbnail.tint, '#6b6355', 0.45)
  if (thumbnail.art === 'constellation') return '#93a6ff'
  if (thumbnail.art === 'real-sky') return '#e5b48f'
  return '#f4b860'
}
