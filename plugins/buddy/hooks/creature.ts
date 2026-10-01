// The companion's look for each mood: a quiet glyph face for the terminal and a
// small animated pebble (SVG, SMIL) for surfaces that draw SVG. It stays grey and
// still; only the eyes and one small prop change, and color means a warning.

export type Mood =
  | 'idle'
  | 'sleeping'
  | 'thinking'
  | 'reading'
  | 'editing'
  | 'running'
  | 'browsing'
  | 'delegating'
  | 'working'
  | 'done'
  | 'error'
  | 'full'

// Face (3 cells) + space + prop (up to 3 cells). Every glyph is single-width.
export const FACE_WIDTH = 7

const EYES: Partial<Record<Mood, string>> = {
  sleeping: '‒‿‒',
  done: '◠‿◠',
  error: '◦⌒◦',
  full: '◦⌒◦',
}

const PROPS: Record<Mood, string[]> = {
  idle: [''],
  sleeping: ['ᶻ', ' ᶻ', '  ᶻ', ''],
  thinking: ['·', '··', '···', ''],
  reading: ['⌕', ' ⌕', '  ⌕', ' ⌕'],
  editing: ['✎', ' ✎', '  ✎', ' ✎'],
  running: ['›', '››', '›››', ''],
  browsing: ['◜', '◝', '◞', '◟'],
  delegating: ['⇢', ' ⇢', '  ⇢', ''],
  working: ['◴', '◷', '◶', '◵'],
  done: ['✧', '⋆', '✧', '·'],
  error: ['!'],
  full: ['!'],
}

// One blink every 16 idle frames.
const BLINK_EVERY = 16

export function face(mood: Mood, frame: number): string {
  let eyes = EYES[mood] ?? '◦‿◦'
  if (mood === 'idle' && frame % BLINK_EVERY === BLINK_EVERY - 1) eyes = '‒‿‒'
  const props = PROPS[mood]
  const prop = props[frame % props.length] ?? ''
  return `${eyes} ${prop}`.padEnd(FACE_WIDTH)
}

// Grey by default; amber from 75% context, red from 90% or on an error.
export function tone(percent: number, mood: Mood): 'calm' | 'warn' | 'alarm' {
  if (mood === 'error' || mood === 'full' || percent >= 90) return 'alarm'
  if (percent >= 75) return 'warn'
  return 'calm'
}

const BODY = { calm: '#7C8494', warn: '#C9963F', alarm: '#D0656E' } as const
const INK = '#7C8494'
const EYE = '#F4F5F7'

const loop = (attr: string, values: string, dur: string, begin = '0s') =>
  `<animate attributeName="${attr}" values="${values}" dur="${dur}" begin="${begin}" repeatCount="indefinite"/>`

const blink = `<animate attributeName="ry" values="1.9;1.9;0.2;1.9" keyTimes="0;0.94;0.97;1" dur="5s" repeatCount="indefinite"/>`

function eyes(glance = ''): string {
  return (
    `<g>${glance}` +
    `<ellipse cx="11" cy="11" rx="1.4" ry="1.9" fill="${EYE}">${blink}</ellipse>` +
    `<ellipse cx="17" cy="11" rx="1.4" ry="1.9" fill="${EYE}">${blink}</ellipse></g>`
  )
}

const glance = (dur: string) =>
  `<animateTransform attributeName="transform" type="translate" values="-1 0;1 0;-1 0" dur="${dur}" repeatCount="indefinite"/>`

// A hairline stroke, optionally with attributes and animation children.
function line(d: string, { stroke = INK, attrs = '', children = '' } = {}): string {
  const open = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"${attrs}`
  return children ? `${open}>${children}</path>` : `${open}/>`
}

// One SVG per mood, 48x22. Animation runs in the surface, so it needs no redraws.
export function svg(mood: Mood, percent: number): string {
  const body = BODY[tone(percent, mood)]
  let breathe = '4s'
  let face = eyes()
  let prop = ''

  switch (mood) {
    case 'sleeping':
      breathe = '6s'
      face = line('M9.5 11.5h3M15.5 11.5h3', { stroke: EYE })
      prop = [0, 1]
        .map(
          i =>
            `<text x="30" y="10" font-size="${6 + i}" font-family="sans-serif" fill="${INK}" opacity="0">z` +
            loop('y', '13;3', '4s', `${i * 2}s`) +
            loop('opacity', '0;0.8;0', '4s', `${i * 2}s`) +
            `</text>`,
        )
        .join('')
      break
    case 'thinking':
      face = eyes(glance('3s'))
      prop = [0, 1, 2]
        .map(i => `<circle cx="${31 + i * 4}" cy="11" r="1.1" fill="${INK}" opacity="0.25">${loop('opacity', '0.25;0.9;0.25', '1.6s', `${i * 0.25}s`)}</circle>`)
        .join('')
      break
    case 'reading':
      face = eyes(glance('1.6s'))
      prop =
        `<g>${line('M34 13.5l3 3')}<circle cx="32" cy="11.5" r="2.8" fill="none" stroke="${INK}" stroke-width="1.2"/>` +
        `<animateTransform attributeName="transform" type="translate" values="-2 0;3 0;-2 0" dur="1.6s" repeatCount="indefinite"/></g>`
      break
    case 'editing':
      prop =
        line('M30 17h12', { attrs: ' stroke-dasharray="12" stroke-dashoffset="12"', children: loop('stroke-dashoffset', '12;0;0', '1.8s') }) +
        `<g>${line('M30 15l5-5 1.6 1.6-5 5H30z')}<animateTransform attributeName="transform" type="translate" values="0 0;8 0;0 0" dur="1.8s" repeatCount="indefinite"/></g>`
      break
    case 'running':
      prop = [0, 1, 2]
        .map(i => line(`M${30 + i * 4} 8l3 3-3 3`, { attrs: ' opacity="0.15"', children: loop('opacity', '0.15;0.9;0.15', '0.9s', `${i * 0.15}s`) }))
        .join('')
      break
    case 'browsing':
      prop =
        `<circle cx="35" cy="11" r="4.5" fill="none" stroke="${INK}" stroke-width="1.2"/>` +
        `<ellipse cx="35" cy="11" rx="2" ry="4.5" fill="none" stroke="${INK}" stroke-width="1">${loop('rx', '0.3;4.5;0.3', '2.4s')}</ellipse>`
      break
    case 'delegating':
      prop =
        `<g><path d="M30 12c0-2.5 1.8-3.6 3.5-3.6s3.5 1.1 3.5 3.6c0 1.8-1.4 2.6-3.5 2.6S30 13.8 30 12z" fill="${body}" opacity="0.6"/>` +
        `<animateTransform attributeName="transform" type="translate" values="-4 0;6 0" dur="2.4s" repeatCount="indefinite"/>` +
        loop('opacity', '0;1;1;0', '2.4s') +
        `</g>`
      break
    case 'working':
      prop =
        `<g transform="translate(35 11)"><path d="M0-4a4 4 0 0 1 4 4" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>` +
        `<circle r="4" fill="none" stroke="${INK}" stroke-width="1.2" opacity="0.25"/>` +
        `<animateTransform attributeName="transform" type="rotate" additive="sum" values="0;360" dur="1.4s" repeatCount="indefinite"/></g>`
      break
    case 'done':
      face = line('M9.5 11.5q1.5-2 3 0M15.5 11.5q1.5-2 3 0', { stroke: EYE })
      prop = [
        [32, 8, 0],
        [38, 13, 0.4],
      ]
        .map(
          ([x, y, begin]) =>
            `<path d="M${x} ${(y ?? 0) - 2.5}l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="${INK}" opacity="0">${loop('opacity', '0;0.9;0', '1.4s', `${begin}s`)}</path>`,
        )
        .join('')
      break
    case 'error':
    case 'full':
      face = eyes() + line('M12 16q2-1.4 4 0', { stroke: EYE })
      prop = `<path d="M33 6v6" stroke="${body}" stroke-width="1.6" stroke-linecap="round"/><circle cx="33" cy="15.5" r="1" fill="${body}"/>`
      break
  }

  // A soft pebble, a little wider at the bottom, breathing from its base.
  const pebble = `<path d="M3 13c0-6 4.5-9.5 11-9.5S25 7 25 13c0 4.5-4 6.5-11 6.5S3 17.5 3 13z" fill="${body}"/>`
  const breath = `<animateTransform attributeName="transform" type="scale" values="1 1;1.02 0.97;1 1" dur="${breathe}" repeatCount="indefinite"/>`

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 22" width="48" height="22" style="overflow:visible">` +
    `<g transform="translate(14 19.5)"><g>${breath}<g transform="translate(-14 -19.5)">${pebble}${face}</g></g></g>` +
    prop +
    `</svg>`
  )
}
