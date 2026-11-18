// The room's shell: the wall darkening toward the ceiling, a faint trellis
// wallpaper, the dado rail with panels below it, the skirting, and the
// floorboards. It spans far past the viewBox so any crop
// of any screen stays inside the room.

import { FLOOR, P, pat } from './paint'
import { Layer, seeded } from './pixels'
import type { SceneInput } from './model'

/** The shell's motion: none yet. */
export const SHELL_CSS = ''

/** A tile of the wallpaper: dotted diagonals crossing into diamonds, 1 pixel in 16 lit. */
function trellis(): string {
  let d = ''
  for (let i = 0; i < 16; i += 2) d += `M${i} ${i}h1v1h-1zM${15 - i} ${i + 1}h1v1h-1z`
  return `<pattern id="pstrellis" width="16" height="16" patternUnits="userSpaceOnUse"><path fill="${P.aubergine}" d="${d}"/></pattern>`
}

export function shellPart(input: SceneInput): string {
  const wall = new Layer()
  // The wall, wide and tall enough for any crop, darkening toward the ceiling.
  wall.rect(-400, -400, 1120, 400 + FLOOR, P.plum)
  wall.rect(-400, -400, 1120, 400 + 6, pat('k3'))
  wall.rect(-400, 6, 1120, 10, pat('k2'))
  wall.rect(-400, 16, 1120, 14, pat('k1'))
  wall.rect(-400, 30, 1120, 14, pat('k4'))
  // The wallpaper between the ceiling's shadow and the rail: a dotted trellis, barely there.
  const paper = `<rect x="-400" y="40" width="1120" height="96" fill="url(#pstrellis)"/>`
  // A dado rail, lit along its top, and sunk panels below it.
  wall.rect(-400, 136, 1120, 1, P.mauve)
  wall.rect(-400, 137, 1120, 1, P.aubergine)
  wall.rect(-400, 138, 1120, 1, P.night)
  for (let x = -400; x < 720; x += 36) {
    wall.rect(x + 3, 141, 30, 1, P.night)
    wall.rect(x + 3, 142, 1, 10, P.night)
    wall.rect(x + 4, 151, 29, 1, P.aubergine)
    wall.rect(x + 32, 142, 1, 9, P.aubergine)
  }
  // The skirting.
  wall.rect(-400, 155, 1120, 1, P.mauve)
  wall.rect(-400, 156, 1120, 4, P.aubergine)
  wall.rect(-400, 159, 1120, 1, P.night)
  // The floor: boards with staggered joints, darker toward the viewer.
  const floor = new Layer()
  floor.rect(-400, FLOOR, 1120, 400, P.night)
  floor.rect(-400, FLOOR, 1120, 1, P.aubergine)
  const random = seeded(5)
  for (let y = FLOOR + 6; y < 240; y += 7) {
    floor.rect(-400, y, 1120, 1, P.ink)
    let x = -400 + Math.floor(random() * 30)
    while (x < 720) {
      floor.rect(x, y - 6, 1, 6, P.ink)
      x += 34 + Math.floor(random() * 30)
    }
  }
  floor.rect(-400, 178, 1120, 12, pat('k1'))
  floor.rect(-400, 190, 1120, 300, pat('k2'))
  void input
  return `<defs>${trellis()}</defs>` + wall.svg() + paper + floor.svg()
}
