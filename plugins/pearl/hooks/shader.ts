// Pearl: a muted, pearly sheen drifting in soft patches over near-black.
import { buffer, clamp, composer, cos, dot, dt, exp, first, floor, fract, length, max, mix, picture, pointer, pointerCount, range, shader, sin, smoothstep, values, vec2, vec3, vec4 } from 'claude-code/shader'
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
      let ptr = vec2(-9, -9)
      if (pointerCount > 0) ptr = vec2(pointer(0).where.x * asp, pointer(0).where.y)
      const here = s2.z
      const q = vec2(uv.x * asp, uv.y)
      const d = vec2(q - ptr)
      const turn = exp(-dot(d, d) * 6) * (0.25 + 0.6 * s2.y) * here
      const qq = vec2(ptr + vec2(d.x * cos(turn) - d.y * sin(turn), d.x * sin(turn) + d.y * cos(turn)))
      const rd = length(vec2(qq - cc)) - ring * 0.35
      const drop = exp(-rd * rd * 40) * clamp(1 - ring / 3, 0, 1)
      const w = vec2(fbm(vec2(qq * 0.9 + drift(ang, 6, 0))), fbm(vec2(qq * 0.9 + vec2(4.1, 0) + drift(ang, 5, 2.4))))
      const thick = fbm(vec2(qq * 1.2 + w * 1.6 + drift(ang, 3, 4))) + drop * 0.2
      const patch = smoothstep(0.35, 0.7, fbm(vec2(qq * 0.7 + w * 1.1 - drift(ang, 2, 1.3))))
      const k = thick * (2.2 + 0.6 * work)
      const iri = vec3(vec3(0.5) + vec3(0.5) * vec3(cos(6.2832 * k), cos(6.2832 * (k + 0.33)), cos(6.2832 * (k + 0.67))))
      const nacre = vec3(mix(vec3(mix(vec3(0.72, 0.7, 0.74), iri, 0.35)), vec3(0.78, 0.55, 0.48), err * 0.5))
      const base = vec3(mix(vec3(0.04, 0.042, 0.05), vec3(0.035, 0.035, 0.045), night))
      const spread = exp(-(length(vec2(qq - cc)) - clamp(s1.y / 3.2, 0, 1) * 0.8) * (length(vec2(qq - cc)) - clamp(s1.y / 3.2, 0, 1) * 0.8) * 14) * done
      // A sent message: one wide, faint ring of sheen leaves the prompt and fades as it goes.
      const sent = length(vec2(qq - cc)) - s1.w * 0.28
      const send = exp(-sent * sent * 22) * clamp(1 - s1.w / 2.4, 0, 1)
      const amount = patch * (0.16 + 0.05 * work) + drop * 0.08 + spread * 0.08 + send * 0.06
      let col = vec3(base + nacre * amount * (0.6 + 0.4 * thick))
      const vv = vec2(vec2(uv - vec2(0.5, 0.48)) * vec2(asp * 0.6, 1))
      col = vec3(col * mix(0.78, 1, smoothstep(1.2, 0.25, length(vv))))
      // A fixed grain and a dither, so nothing flickers and nothing bands.
      col = vec3(col + (hash(floor(p.pixel)) - 0.5) * 0.006 + (hash(vec2(floor(p.pixel) * 1.37 + 0.5)) - 0.5) * 0.012)
      return vec4(max(col, 0), 1)
    }),
  ],
})
