// Light Leak: a quiet warm glow seeping in at the corner of a dark frame.
import { buffer, clamp, composer, dot, dt, exp, first, floor, fract, length, max, mix, picture, pointer, pointerCount, pow, range, shader, sin, smoothstep, values, vec2, vec3, vec4 } from 'claude-code/shader'
import type { Buffer } from 'claude-code/shader'

const v = values({ work: [0, 1], calls: [0, 1023], errs: [0, 1023], turns: [0, 1023], sends: [0, 1023], hour: [0, 24] })

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
// 2: the flow's phase, the pointer's stir, the pointer's presence
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
  const t2 = vec4(s2.x + dt * (0.15 + 0.22 * v.work + 0.12 * stir * presence), stir, presence, 0)
  if (first) return p.cell.x < 1 ? vec4(c, 99, er, 99) : p.cell.x < 2 ? vec4(tu, 99, se, 99) : vec4(0, 0, 0, 0)
  return p.cell.x < 1 ? t0 : p.cell.x < 2 ? t1 : t2
})

// The shared light of a frame: Claude's state as gentle numbers, and the hour as night and warmth.
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
      const t = s2.x
      const night = clamp(smoothstep(17, 21, v.hour) + 1 - smoothstep(4, 7, v.hour), 0, 1)
      const warm = exp(-((v.hour - 6) / 1.2) * ((v.hour - 6) / 1.2)) + exp(-((v.hour - 18.5) / 1.2) * ((v.hour - 18.5) / 1.2))
      const work = v.work
      const err = life(s0.w, 2.4)
      const done = life(s1.y, 3.2)
      const send = clamp(1 - s1.w / 2.4, 0, 1)
      const ring = s0.y
      const grow = clamp((composer.w - composer.y - 0.11) * 5, 0, 1)
      let ptr = vec2(-9, -9)
      if (pointerCount > 0) ptr = vec2(pointer(0).where.x * asp, pointer(0).where.y)
      const here = s2.z
      const q = vec2(uv.x * asp, uv.y)
      const n = fbm(vec2(q * 0.8 + vec2(t * 0.03, -t * 0.02)))
      const base = vec3(mix(vec3(0.045, 0.04, 0.037), vec3(0.04, 0.033, 0.033), night))
      const d1 = length(vec2(vec2(uv - vec2(-0.05, 0.05)) * vec2(asp * 0.9, 1)))
      const l1 = exp(-d1 * d1 * (2.4 - 0.6 * work)) * (0.7 + 0.3 * n)
      const l2 = smoothstep(0.55, 1.08, uv.x + (n - 0.5) * 0.25) * smoothstep(0, 0.7, uv.y) * 0.45
      const cx = (composer.x + composer.z) * 0.5
      const cwid = max(0.05, composer.z - composer.x)
      const flare = life(ring, 1.6)
      let leak = l1 * (0.55 + 0.2 * work + 0.08 * flare) + l2 * (0.35 + 0.1 * work)
      leak += done * 0.35 * smoothstep(0.5, 1.1, uv.x + (n - 0.5) * 0.2)
      leak += send * 0.25 * exp(-((uv.x - cx) / (cwid * 0.9)) * ((uv.x - cx) / (cwid * 0.9))) * smoothstep(0.4, 0, uv.y)
      const pd = vec2(q - ptr)
      leak += 0.06 * here * exp(-dot(pd, pd) * 3.5)
      leak += (0.08 + 0.08 * grow) * exp(-((uv.x - cx) / (cwid * 0.8)) * ((uv.x - cx) / (cwid * 0.8))) * smoothstep(composer.w + 0.08, 0, uv.y)
      const amber = vec3(mix(vec3(0.75, 0.42, 0.24), vec3(0.8, 0.45, 0.36), clamp(warm, 0, 1)))
      const lcol = vec3(mix(amber, vec3(0.8, 0.35, 0.38), err * 0.7))
      let col = vec3(base + lcol * leak * 0.32 + vec3(0.9, 0.75, 0.6) * pow(clamp(leak, 0, 1.5), 3) * 0.06)
      const vv = vec2(vec2(uv - vec2(0.5, 0.48)) * vec2(asp * 0.6, 1))
      col = vec3(col * mix(0.78, 1, smoothstep(1.2, 0.25, length(vv))))
      // A fixed grain and a dither, so nothing flickers and nothing bands.
      col = vec3(col + (hash(floor(p.pixel)) - 0.5) * 0.006 + (hash(vec2(floor(p.pixel) * 1.37 + 0.5)) - 0.5) * 0.012)
      return vec4(max(col, 0), 1)
    }),
  ],
})
