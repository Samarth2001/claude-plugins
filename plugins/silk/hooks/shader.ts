// Silk: graphite satin folding slowly, a soft sheen drifting over it.
import { buffer, clamp, composer, cos, dot, dt, exp, first, floor, fract, length, max, mix, normalize, picture, pointer, pointerCount, pow, range, shader, sin, smoothstep, values, vec2, vec3, vec4 } from 'claude-code/shader'
import type { Buffer } from 'claude-code/shader'

const v = values({ work: [0, 1], calls: [0, 1023], errs: [0, 1023], turns: [0, 1023], sends: [0, 1023], night: [0, 1], warm: [0, 1] })

// The flow is a phase on one slow turn, kept between 0 and 1, and the noise drifts along circles at the
// pace the flow sets. Bounded, so the grain stays as fine after a week open as in the first minute.
const LOOP = 1256.637 // flow units in one turn: about two hours at rest
function drift(turn: number, radius: number, start: number): vec2 {
  return vec2(vec2(cos(turn + start), sin(turn + start)) * radius)
}

function hash(p: vec2): number {
  const q = vec2(fract(p * vec2(123.34, 456.21)))
  const r = vec2(q + dot(q, vec2(q + 45.32)))
  return fract(r.x * r.y)
}

function noise(p: vec2): number {
  const i = vec2(floor(p))
  const f = vec2(fract(p))
  const u = vec2(f * f * (3 - 2 * f))
  return mix(mix(hash(i), hash(vec2(i + vec2(1, 0))), u.x), mix(hash(vec2(i + vec2(0, 1))), hash(vec2(i + vec2(1, 1))), u.x), u.y)
}

// Three octaves only: large, soft shapes.
function fbm(start: vec2): number {
  // Away from the lattice origin, whose cell always hashes to 0 and would darken these low frequencies.
  let p = vec2(start + vec2(23.1, 9.4))
  let total = 0
  let amp = 0.5
  for (const _ of range(3)) {
    total += amp * noise(p)
    p = vec2(vec2(0.8 * p.x + 0.6 * p.y, -0.6 * p.x + 0.8 * p.y) * 2.03 + vec2(3.1, 1.7))
    amp *= 0.5
  }
  return total / 0.875
}

// What piles up or fades, one texel each.
// 0: calls seen, seconds since a call, errors seen, seconds since an error
// 1: turns seen, seconds since a turn ended, sends seen, seconds since a send
// 2: the flow's phase on its turn, the pointer's stir, the pointer's presence
const state: Buffer = buffer({ size: [3, 1], float: 32, filter: 'nearest' }, p => {
  const s0 = state.at(vec2(0, 0))
  const s1 = state.at(vec2(1, 0))
  const s2 = state.at(vec2(2, 0))
  const c = floor(v.calls + 0.5)
  const er = floor(v.errs + 0.5)
  const tu = floor(v.turns + 0.5)
  const se = floor(v.sends + 0.5)
  let speed = 0
  let here = 0
  if (pointerCount > 0) {
    const pt = pointer(0)
    speed = length(vec2(pt.where.xy - pt.where.zw)) / max(dt, 0.001)
    here = pt.gone > 0 ? 0 : 1
  }
  const stir = clamp(max(s2.y - dt * 0.6, speed * 0.4), 0, 1)
  const presence = mix(s2.z, here, clamp(dt * 1.2, 0, 1))
  const t0 = vec4(c, c === s0.x ? s0.y + dt : 0, er, er === s0.z ? s0.w + dt : 0)
  const t1 = vec4(tu, tu === s1.x ? s1.y + dt : 0, se, se === s1.z ? s1.w + dt : 0)
  const t2 = vec4(fract(s2.x + (dt * (0.15 + 0.22 * v.work + 0.12 * stir * presence)) / LOOP), stir, presence, 0)
  if (first) return p.cell.x < 1 ? vec4(c, 99, er, 99) : p.cell.x < 2 ? vec4(tu, 99, se, 99) : vec4(0, 0, 0, 0)
  return p.cell.x < 1 ? t0 : p.cell.x < 2 ? t1 : t2
})

// The shared light of a frame: Claude's state as gentle numbers; night and warmth come from the plugin's clock.
function life(age: number, span: number): number {
  return sin(3.14159 * clamp(age / span, 0, 1))
}
// The cloth's height: three slow waves, each a whole number of times round the flow's turn.
function fold(q: vec2, w: number, turn: number): number {
  return 0.6 * sin(q.x * 1.6 + w * 2.2 + turn * 24) + 0.3 * sin(q.x * 2.9 - q.y * 1.2 + w * 1.4 - turn * 16) + 0.15 * sin(q.y * 2.3 + q.x * 0.6 + turn * 12)
}

export default shader({
  fps: 30,
  passes: [
    state,
    picture(p => {
      const s0 = state.at(vec2(0, 0))
      const s1 = state.at(vec2(1, 0))
      const s2 = state.at(vec2(2, 0))
      const uv = p.uv
      const asp = p.point.x / max(uv.x, 0.0001) / max(p.point.y / max(uv.y, 0.0001), 0.0001)
      const ang = s2.x * 6.28318
      const night = v.night
      const work = v.work
      const err = life(s0.w, 2.4)
      const done = life(s1.y, 3.2)
      const ring = s0.y
      const cc = vec2((composer.x + composer.z) * 0.5 * asp, (composer.y + composer.w) * 0.5)
      const cw = max(0.05, (composer.z - composer.x) * asp)
      let ptr = vec2(-9, -9)
      if (pointerCount > 0) ptr = vec2(pointer(0).where.x * asp, pointer(0).where.y)
      const here = s2.z
      const q = vec2(uv.x * asp, uv.y)
      const w = fbm(vec2(q * 0.8 + drift(ang, 7.2, 0.7)))
      const rd = length(vec2(q - cc)) - ring * 0.4
      const wave = exp(-rd * rd * 12) * clamp(1 - ring / 3.2, 0, 1) * 0.25
      const e = 0.004
      // The wave's distance from the prompt, taken again a step to the right and a step up, so its slope is true.
      const rdx = length(vec2(q + vec2(e, 0) - cc)) - ring * 0.4
      const rdy = length(vec2(q + vec2(0, e) - cc)) - ring * 0.4
      const h = fold(q, w, ang) + wave * sin(rd * 14)
      const hx = fold(vec2(q + vec2(e, 0)), w, ang) + wave * sin(rdx * 14)
      const hy = fold(vec2(q + vec2(0, e)), w, ang) + wave * sin(rdy * 14)
      const nrm = vec3(normalize(vec3(-(hx - h) / e * 0.18, -(hy - h) / e * 0.18, 1)))
      let lp = vec2(0.3 * asp + 0.1 * sin(ang * 10), 0.95)
      lp = vec2(mix(lp, ptr, 0.35 * here))
      const L = vec3(normalize(vec3(lp.x - q.x, lp.y - q.y, 1.2)))
      const R = vec3(nrm * (2 * dot(nrm, L)) - L)
      const diff = max(dot(nrm, L), 0)
      const spec = pow(max(R.z, 0), 6)
      const cloth = vec3(mix(vec3(0.05, 0.052, 0.06), vec3(0.045, 0.042, 0.058), night))
      const sheen = vec3(mix(vec3(mix(vec3(0.42, 0.46, 0.52), vec3(0.42, 0.38, 0.52), night)), vec3(0.6, 0.36, 0.36), err * 0.5))
      let col = vec3(cloth * (0.55 + 0.7 * diff) + sheen * spec * (0.07 + 0.04 * work))
      const bx = clamp(s1.y / 3.2, 0, 1) * 1.6 - 0.3
      col = vec3(col + sheen * 0.08 * exp(-(uv.x - bx) * (uv.x - bx) * 12) * done)
      const hd = vec2(vec2(q - cc) / vec2(cw * 0.8, 0.3))
      col = vec3(col + vec3(0.85, 0.65, 0.5) * exp(-dot(hd, hd) * 1.4) * 0.025)
      const vv = vec2(vec2(uv - vec2(0.5, 0.48)) * vec2(asp * 0.6, 1))
      col = vec3(col * mix(0.78, 1, smoothstep(1.2, 0.25, length(vv))))
      // A fixed grain and a dither, so nothing flickers and nothing bands.
      col = vec3(col + (hash(floor(p.pixel)) - 0.5) * 0.006 + (hash(vec2(floor(p.pixel) * 1.37 + 0.5)) - 0.5) * 0.012)
      return vec4(max(col, 0), 1)
    }),
  ],
})
