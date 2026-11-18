// The room's pixel maps, one character per art pixel, `.` for none. Rows are
// written run-length: a count before a character repeats it (`3o` is `ooo`),
// so a row's width is plain arithmetic. The cat's maps share one key
// (CAT_KEYS); each object names its own.

import { PAL } from './palette'
import type { Inks, Sprite } from './pixels'

/** A sprite from run-length rows. */
export function rle(rows: readonly string[]): Sprite {
  return rows.map(row => row.replace(/(\d+)(\D)/g, (_, count: string, ch: string) => ch.repeat(Number(count))))
}

/** The cat's colors: an orange tabby with a cream chest, umber-lined. */
export const CAT_KEYS: Inks = {
  k: PAL.umber,
  o: PAL.ember,
  d: PAL.rust,
  c: PAL.cream,
  n: PAL.rose,
  e: PAL.leaf,
  p: PAL.ink,
  w: PAL.cream,
}

/** Curled up asleep, head on its paws to the right, tail wrapped along the front: out-breath, in-breath. */
export const ASLEEP: readonly Sprite[] = [
  rle([
    '15.k5.k2.',
    '14.knk3.knk.',
    '4.8k.kono3konok',
    '2.2kod2od2odok3odod3ok',
    '.k3od2od2odok9ok',
    'k12oko2k3o2kok',
    'k12okc3on3ock',
    'k12o.k7ck.',
    'k12o.k2ck.k2ck.',
    'kd12k4k.4k.',
    'kd2o2d2o2d2o2d2o3ck4.',
    '.19k4.',
  ]),
  rle([
    '15.k5.k2.',
    '5.6k3.knk3.knk.',
    '4.k6ok.kono3konok',
    '2.2kod2od2odok3odod3ok',
    '.k3od2od2odok9ok',
    'k12oko2k3o2kok',
    'k12okc3on3ock',
    'k12o.k7ck.',
    'k12o.k2ck.k2ck.',
    'kd12k4k.4k.',
    'kd2o2d2o2d2o2d2o3ck4.',
    '.19k4.',
  ]),
]

/** Walking, facing right: body and head without legs (WALK_LEGS draws those). */
export const WALK_BODY: Sprite = rle([
  '.2k17.k3.k2.',
  'k2dk15.knk.knk.',
  'kdk16.k2ok2ok.',
  'kdk15.k7ok',
  'kdk15.kod2oepok',
  '.kdk2.12k6o2cn',
  '2.kdkdod2od2od4o5o2ck.',
  '4.k13o4o3ck.',
  '4.k16o3ck2.',
  '4.k17ok4.',
  '4.k2d14o2dk3.',
  '5.18k4.',
])

type Leg = { x: number; reach: number; lift: boolean; far: boolean }

/** Four rows of legs from WALK_BODY's last row down: each leg two pixels wide, far legs in shadow. */
function legs(list: readonly Leg[]): Sprite {
  const width = 27
  const rows = [0, 1, 2, 3].map(() => Array<string>(width).fill('.'))
  const put = (r: number, x: number, ch: string) => {
    const row = rows[r]
    if (row !== undefined && x >= 0 && x < width && (row[x] === '.' || ch !== 'k')) row[x] = ch
  }
  const limb = (r: number, x: number, fill: string, fill2 = fill) => {
    put(r, x - 1, 'k')
    put(r, x, fill)
    put(r, x + 1, fill2)
    put(r, x + 2, 'k')
  }
  // Far legs first, so the near ones draw over them.
  for (const leg of [...list].sort((a, b) => Number(b.far) - Number(a.far))) {
    const fur = leg.far ? 'd' : 'o'
    const foot = leg.x + leg.reach
    put(0, leg.x, fur)
    put(0, leg.x + 1, fur)
    limb(1, leg.x, fur)
    if (leg.lift) {
      limb(2, foot, 'c')
    } else {
      limb(2, Math.round((leg.x + foot) / 2), fur)
      limb(3, foot, 'c')
    }
  }
  return rows.map(row => row.join(''))
}

export const WALK_LEGS: readonly Sprite[] = [
  // Stride: near hind leg back, near fore leg forward.
  legs([
    { x: 6, reach: -1, lift: false, far: false },
    { x: 9, reach: 1, lift: false, far: true },
    { x: 18, reach: 1, lift: false, far: false },
    { x: 20, reach: -1, lift: false, far: true },
  ]),
  // Passing: the far legs swing through, lifted.
  legs([
    { x: 7, reach: 0, lift: false, far: false },
    { x: 8, reach: 1, lift: true, far: true },
    { x: 19, reach: 0, lift: false, far: false },
    { x: 20, reach: 1, lift: true, far: true },
  ]),
  // Stride, the other way.
  legs([
    { x: 6, reach: -1, lift: false, far: true },
    { x: 9, reach: 1, lift: false, far: false },
    { x: 18, reach: 1, lift: false, far: true },
    { x: 20, reach: -1, lift: false, far: false },
  ]),
  // Passing: the near legs swing through, lifted.
  legs([
    { x: 7, reach: 0, lift: false, far: true },
    { x: 8, reach: 1, lift: true, far: false },
    { x: 19, reach: 0, lift: false, far: true },
    { x: 20, reach: 1, lift: true, far: false },
  ]),
]

/** Sitting up, facing right toward the desk. */
export const SIT: Sprite = rle([
  '8.k3.k5.',
  '7.knk.knk4.',
  '7.k2ok3ok3.',
  '6.k8ok2.',
  '6.k3od2odok2.',
  '6.k6oepk2.',
  '6.k8onk.',
  '6.k6o3ck.',
  '7.kc3o3ck2.',
  '7.k6ck3.',
  '6.ko5ck4.',
  '5.k3o4ck4.',
  '4.k5o3cok3.',
  '3.k2odo2o2c2ok3.',
  '3.k5o2c3ok3.',
  '2.k2odo2o2c3ok3.',
  '2.k6o2c3ok3.',
  '2.k2od4oc3ok3.',
  '2.k6o5ok3.',
  '2.k5ok2ck2ck3.',
  '3.12k3.',
])

/** The sitter's tail along the floor, its tip in three places: drawn at SIT's lower left. */
export const SIT_TAIL: readonly Sprite[] = [
  rle(['2.2k6.', '.k2dk5.', 'kdk7.', 'kdk7.', 'kd4k4.', '.k5dk2.', '2.5k3.']),
  rle(['10.', '10.', '10.', '2k8.', 'kd4k4.', '.k5dk2.', '2.5k3.']),
  rle(['10.', '2k8.', 'kdk7.', 'k2dk6.', 'k2d3k4.', '.k5dk2.', '2.5k3.']),
]

/** Startled: sitting, ears flat, eyes wide, fur and tail on end. */
export const STARTLED: Sprite = rle([
  '18.',
  '18.',
  '6.k.2k.2k.k3.',
  '5.k10ok.',
  '6.k3od2odok2.',
  '6.k3owepwok2.',
  '6.k3ow2p2ok2.',
  '6.k8onk.',
  '7.kc3o2c2ck.',
  '7.k6ck3.',
  '5.kko5ck4.',
  '4.k4o4ck4.',
  '3.kk5o3cok3.',
  '3.k2odo2o2c2ok3.',
  '2.kk5o2c3ok3.',
  '2.k2odo2o2c3ok3.',
  '.kk6o2c3ok3.',
  '2.k2od4oc3ok3.',
  '2.k6o5ok3.',
  '2.k5ok2ck2ck3.',
  '3.12k3.',
])

/** The startled tail, straight up and bristling, drawn at STARTLED's left. */
export const STARTLED_TAIL: Sprite = rle([
  '2.k.k2.',
  '.kdkdk.',
  'k5dk',
  '.k3dk.',
  'k5dk',
  '.k3dk.',
  'k5dk',
  '.k3dk.',
  '2.kdk2.',
  '2.kdk2.',
  '2.kdk2.',
  '3.kdk.',
  '3.kdk.',
])

/** Stretching: front legs out along the cushion, rump up, tail high. */
export const STRETCH: Sprite = rle([
  '.2k25.',
  'k2dk24.',
  '.kdk24.',
  '.kd6k19.',
  '.kd6o3k16.',
  '.kod2od3o2o3k13.',
  '.k12o3k2..k3.k3.',
  '.k15o2kknk.knk2.',
  '.k17ok6ok.',
  '.k5ok9k2oko2ko2kok',
  '.k4ok9.k2okc2on2ock',
  '.k4ok8.k11ok',
  '.k2ck2ck7.k8k3ck',
])

/** A small z that drifts up from the sleeper. */
export const ZED: Sprite = ['zzz', '..z', '.z.', 'zzz']

/** A heart that rises from the cat when it is petted: rose with a cream glint, umber-lined. */
export const HEART: Sprite = rle(['.2k.2k.', 'kcnknnk', 'k5nk', '.k3nk.', '2.knk2.', '3.k3.'])
