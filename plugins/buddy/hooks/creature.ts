// The companion's look for each mood: text frames for the terminal and an
// animated SVG (SMIL) for surfaces that draw SVG.

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

export const FACE_WIDTH = 11

const FACES: Record<Mood, string[]> = {
  idle: ['(•◡•)', '(•◡•)', '(•◡•)', '(•◡•)', '(-◡-)'],
  sleeping: ['(-◡-) z', '(-◡-) zZ', '(-◡-) zZz', '(-◡-)'],
  thinking: ['(•_• ) ·', '( •_•) ··', '(•_• ) ···', '( •_•)'],
  reading: ['(o_o)>', '(o_o) >', '(o_o)  >', '(o_o)   >'],
  editing: ['(•_•)✎', '(•_•) ✎', '(•_•)  ✎', '(•_•) ✎'],
  running: ['ᕕ(•_•)ᕗ', 'ᕙ(•_•)ᕗ', 'ᕕ(•_•)ᕤ', 'ᕙ(•_•)ᕤ'],
  browsing: ['(•_•))', '(•_•)))', '(•_•))))', '(•_•)'],
  delegating: ['(•_•)', '(•_•)→(·)', '(•_•) (•_•)', '(•_•)→(·)'],
  working: ['(•_•)⚙', '(•_•)✲', '(•_•)⚙', '(•_•)✲'],
  done: ['\\(^◡^)/', '(^◡^) ✦', '\\(^◡^)/ ✧', '(^◡^)'],
  error: ['(°□°)!', '(°□°) !', '(°□°)!', '(°□°)'],
  full: ['(×◡×)', '(×_×)', '(×◡×)', '(×_×)'],
}

export function face(mood: Mood, frame: number, isSweating: boolean): string {
  const frames = FACES[mood]
  let out = frames[frame % frames.length] ?? frames[0] ?? ''
  if (isSweating) out = out.replace(')', ';)')
  return out.padEnd(FACE_WIDTH)
}

// Body color follows how full the context window is.
export function bodyColor(percent: number): string {
  if (percent >= 90) return '#E5484D'
  if (percent >= 75) return '#D6409F'
  if (percent >= 50) return '#E2A336'
  return '#4C9AFF'
}

const blink = `<animate attributeName="ry" values="2.4;2.4;0.3;2.4" keyTimes="0;0.9;0.95;1" dur="4s" repeatCount="indefinite"/>`

function eyes(dx: string, extra = ''): string {
  return `<g>${extra}<ellipse cx="13" cy="15" rx="1.8" ry="2.4" fill="#fff">${blink}</ellipse><ellipse cx="21" cy="15" rx="1.8" ry="2.4" fill="#fff">${blink}</ellipse>${dx}</g>`
}

function lookAround(dur: string): string {
  return `<animateTransform attributeName="transform" type="translate" values="-1.5 0;1.5 0;-1.5 0" dur="${dur}" repeatCount="indefinite"/>`
}

// One SVG per mood, 64x32. Animation runs in the surface, so it needs no redraws.
export function svg(mood: Mood, color: string, isSweating: boolean): string {
  const breathe = `<animateTransform attributeName="transform" type="scale" additive="sum" values="1 1;1.03 0.97;1 1" dur="3s" repeatCount="indefinite"/>`
  const bounce = `<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="0.45s" repeatCount="indefinite"/>`
  const hop = `<animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0;0 0" dur="0.8s" repeatCount="indefinite"/>`
  const shake = `<animateTransform attributeName="transform" type="translate" values="0 0;-1.5 0;1.5 0;0 0" dur="0.25s" repeatCount="indefinite"/>`

  let bodyMotion = breathe
  let face = eyes('')
  let props = ''

  switch (mood) {
    case 'sleeping':
      face = `<path d="M11 15h4M19 15h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`
      props = [0, 1, 2]
        .map(
          i =>
            `<text x="34" y="14" font-size="${7 + i}" font-family="sans-serif" fill="currentColor" opacity="0">z<animate attributeName="y" values="16;4" dur="3s" begin="${i}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.9;0" dur="3s" begin="${i}s" repeatCount="indefinite"/></text>`,
        )
        .join('')
      break
    case 'thinking':
      face = eyes(lookAround('2s'))
      props = [0, 1, 2]
        .map(
          i =>
            `<circle cx="${38 + i * 6}" cy="10" r="2" fill="currentColor" opacity="0.2"><animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin="${i * 0.2}s" repeatCount="indefinite"/></circle>`,
        )
        .join('')
      break
    case 'reading':
      face = eyes(lookAround('0.8s'))
      props = `<rect x="38" y="8" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="41" y="12" width="10" height="1.6" fill="currentColor"><animate attributeName="y" values="12;22;12" dur="1.6s" repeatCount="indefinite"/></rect>`
      break
    case 'editing':
      props = `<path d="M38 26h18" stroke="currentColor" stroke-width="1.4" stroke-dasharray="18" stroke-dashoffset="18"><animate attributeName="stroke-dashoffset" values="18;0;0" dur="1.2s" repeatCount="indefinite"/></path><g><path d="M40 22l8-8 3 3-8 8h-3z" fill="currentColor"/><animateTransform attributeName="transform" type="translate" values="0 0;8 0;0 0" dur="1.2s" repeatCount="indefinite"/></g>`
      break
    case 'running':
      bodyMotion = bounce
      props = [0, 1, 2]
        .map(
          i =>
            `<path d="M${40 + i * 6} ${12 + i * 5}h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0;0.8;0" dur="0.6s" begin="${i * 0.15}s" repeatCount="indefinite"/></path>`,
        )
        .join('')
      break
    case 'browsing':
      props =
        `<circle cx="38" cy="18" r="2" fill="currentColor"/>` +
        [0, 1, 2]
          .map(
            i =>
              `<path d="M${40 + i * 5} ${12 - i * 3}a${6 + i * 4} ${6 + i * 4} 0 0 1 0 ${12 + i * 6}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0" transform="translate(${-4 - i * 3} 0)"><animate attributeName="opacity" values="0;0.9;0" dur="1.5s" begin="${i * 0.3}s" repeatCount="indefinite"/></path>`,
          )
          .join('')
      break
    case 'delegating':
      props = `<g><circle cx="46" cy="18" r="6" fill="${color}" opacity="0.7"/><circle cx="44.5" cy="17" r="1" fill="#fff"/><circle cx="47.5" cy="17" r="1" fill="#fff"/><animateTransform attributeName="transform" type="translate" values="-8 0;0 0;0 0;-8 0" dur="2s" repeatCount="indefinite"/></g>`
      break
    case 'working':
      props = `<g transform="translate(46 17)"><path d="M0-7l2 3 3-1 0 3 3 2-3 2 0 3-3-1-2 3-2-3-3 1 0-3-3-2 3-2 0-3 3 1z" fill="currentColor"/><circle r="2" fill="${color}"/><animateTransform attributeName="transform" type="rotate" additive="sum" values="0;360" dur="2s" repeatCount="indefinite"/></g>`
      break
    case 'done':
      bodyMotion = hop
      face = `<path d="M11 15q2-2.5 4 0M19 15q2-2.5 4 0" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
      props = [
        [40, 8],
        [50, 14],
        [44, 24],
      ]
        .map(
          ([x, y], i) =>
            `<path d="M${x} ${(y ?? 0) - 3}l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill="#E2A336" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="0.9s" begin="${i * 0.25}s" repeatCount="indefinite"/></path>`,
        )
        .join('')
      break
    case 'error':
      bodyMotion = shake
      face = `<path d="M11 13l4 4M15 13l-4 4M19 13l4 4M23 13l-4 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`
      props = `<text x="38" y="22" font-size="16" font-weight="700" font-family="sans-serif" fill="#E5484D">!<animate attributeName="opacity" values="1;0.2;1" dur="0.6s" repeatCount="indefinite"/></text>`
      break
    case 'full':
      face = `<path d="M11 13l4 4M15 13l-4 4M19 13l4 4M23 13l-4 4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`
      props = `<rect x="38" y="10" width="20" height="12" rx="2" fill="none" stroke="#E5484D" stroke-width="1.4"/><rect x="40" y="12" width="16" height="8" fill="#E5484D"><animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite"/></rect>`
      break
  }

  const sweat = isSweating
    ? `<path d="M27 6q2 3 0 4.5q-2-1.5 0-4.5z" fill="#7FD1FF"><animateTransform attributeName="transform" type="translate" values="0 0;0 4;0 0" dur="1.5s" repeatCount="indefinite"/></path>`
    : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 32" width="64" height="32" style="color:#8B93A7;overflow:visible">` +
    `<g transform="translate(17 18)"><g><g transform="translate(-17 -18)">` +
    `<line x1="17" y1="6" x2="17" y2="2" stroke="${color}" stroke-width="1.4"/><circle cx="17" cy="2" r="1.6" fill="${color}"><animate attributeName="r" values="1.2;2;1.2" dur="1.5s" repeatCount="indefinite"/></circle>` +
    `<ellipse cx="17" cy="18" rx="12" ry="11" fill="${color}"/>${face}</g>${bodyMotion}</g></g>` +
    `${sweat}${props}</svg>`
  )
}
