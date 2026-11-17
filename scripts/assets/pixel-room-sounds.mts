// Synthesizes plugins/pixel-room/sounds/finish.wav and failure.wav: short, quiet,
// lo-fi tones as 16-bit mono PCM, the same bytes on every run.
//
//   node --experimental-strip-types scripts/assets/pixel-room-sounds.mts [--check]
//
// With --check it writes nothing and exits 1 when a committed file is stale.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

import { path } from '../lib.mts'

const RATE = 22_050
const SECONDS = 0.6

type Note = { hz: number; at: number; gain: number }
type Voice = { notes: Note[]; decay: number; brightness: number; cutoff: number }

// A soft chime rising a fourth, and a low tone falling a major third.
const FINISH: Voice = {
  notes: [{ hz: 659.25, at: 0, gain: 0.8 }, { hz: 880, at: 0.13, gain: 1 }],
  decay: 0.17,
  brightness: 0.18,
  cutoff: 3200,
}
const FAILURE: Voice = {
  notes: [{ hz: 233.08, at: 0, gain: 1 }, { hz: 185, at: 0.16, gain: 0.9 }],
  decay: 0.2,
  brightness: 0.35,
  cutoff: 1400,
}

function render(voice: Voice, peak: number): Int16Array {
  const length = Math.round(RATE * SECONDS)
  const raw = new Float64Array(length)
  for (const note of voice.notes) {
    const start = Math.round(note.at * RATE)
    for (let i = start; i < length; i += 1) {
      const t = (i - start) / RATE
      // A short attack, then an exponential decay, so no note starts with a click.
      const envelope = Math.min(1, t / 0.008) * Math.exp(-t / voice.decay)
      const phase = 2 * Math.PI * note.hz * t
      raw[i] = (raw[i] ?? 0) + note.gain * envelope * (Math.sin(phase) + voice.brightness * Math.sin(2 * phase) + 0.06 * Math.sin(3 * phase))
    }
  }
  // A one-pole low-pass rounds the tone off, for the lo-fi warmth.
  const alpha = 1 - Math.exp((-2 * Math.PI * voice.cutoff) / RATE)
  let smooth = 0
  let max = 0
  for (let i = 0; i < length; i += 1) {
    smooth += alpha * ((raw[i] ?? 0) - smooth)
    raw[i] = smooth
    max = Math.max(max, Math.abs(smooth))
  }
  // A 40 ms fade at the end, then scale to a quiet peak.
  const fade = Math.round(0.04 * RATE)
  const out = new Int16Array(length)
  for (let i = 0; i < length; i += 1) {
    const tail = Math.min(1, (length - 1 - i) / fade)
    out[i] = Math.round(((raw[i] ?? 0) / max) * peak * tail * 32767)
  }
  return out
}

function wav(samples: Int16Array): Buffer {
  const data = samples.length * 2
  const out = Buffer.alloc(44 + data)
  out.write('RIFF', 0, 'ascii')
  out.writeUInt32LE(36 + data, 4)
  out.write('WAVE', 8, 'ascii')
  out.write('fmt ', 12, 'ascii')
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20) // PCM
  out.writeUInt16LE(1, 22) // mono
  out.writeUInt32LE(RATE, 24)
  out.writeUInt32LE(RATE * 2, 28)
  out.writeUInt16LE(2, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36, 'ascii')
  out.writeUInt32LE(data, 40)
  samples.forEach((sample, i) => out.writeInt16LE(sample, 44 + i * 2))
  return out
}

const FILES: Record<string, Buffer> = {
  'plugins/pixel-room/sounds/finish.wav': wav(render(FINISH, 0.32)),
  'plugins/pixel-room/sounds/failure.wav': wav(render(FAILURE, 0.3)),
}

const isCheck = process.argv.includes('--check')
let isStale = false
for (const [file, bytes] of Object.entries(FILES)) {
  const at = path(file)
  if (isCheck) {
    if (!existsSync(at) || !readFileSync(at).equals(bytes)) {
      console.error(`${file} is stale: run node --experimental-strip-types scripts/assets/pixel-room-sounds.mts`)
      isStale = true
    }
  } else {
    mkdirSync(new URL('./', at), { recursive: true })
    writeFileSync(at, bytes)
    console.log(`Wrote ${file} (${bytes.length} bytes).`)
  }
}
if (isCheck && isStale) process.exit(1)
if (isCheck) console.log('The pixel-room sounds are up to date.')
