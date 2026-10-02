// Pure helpers: what a tool call looks like to buddy, and how numbers print.

import type { Activity } from '../types'

export function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}

// A tool call as a mood, a verb and what it acts on.
export function activityOf(tool: string, input: Record<string, unknown>): Activity {
  const text = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : undefined)
  const path = text('file_path') ?? text('notebook_path') ?? text('path')

  switch (tool) {
    case 'Read':
      return { mood: 'reading', verb: 'reading', target: path && basename(path) }
    case 'Grep':
    case 'Glob':
      return { mood: 'reading', verb: 'searching', target: text('pattern') }
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { mood: 'editing', verb: 'editing', target: path && basename(path) }
    case 'Write':
      return { mood: 'editing', verb: 'writing', target: path && basename(path) }
    case 'Bash':
    case 'PowerShell':
      return { mood: 'running', verb: 'running', target: text('command')?.split(/\s+/).slice(0, 3).join(' ') }
    case 'WebFetch':
      return { mood: 'browsing', verb: 'fetching', target: text('url')?.replace(/^https?:\/\//, '').split('/')[0] }
    case 'WebSearch':
      return { mood: 'browsing', verb: 'searching the web for', target: text('query') }
    case 'Agent':
    case 'Task':
      return { mood: 'delegating', verb: 'delegating', target: text('description') }
    default:
      return tool.startsWith('mcp__')
        ? { mood: 'working', verb: 'using', target: tool.split('__').slice(1).join(' ') }
        : { mood: 'working', verb: 'using', target: tool }
  }
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}k`
  return `${n}`
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s >= 3600) return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
  return s >= 60 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

export function formatUntil(resetsAt: string, now: number): string {
  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - now) / 60_000))
  if (minutes >= 24 * 60) return `${Math.floor(minutes / 1440)}d${Math.floor((minutes % 1440) / 60)}h`
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}m`
  return `${minutes}m`
}

const BARS = '▁▂▃▄▅▆▇█'

// One bar per reading, 0-100%.
export function spark(percent: number): string {
  const i = Math.round((Math.min(100, Math.max(0, percent)) / 100) * (BARS.length - 1))
  return BARS[i] ?? BARS[0] ?? ''
}

export function meter(percent: number, cells: number): { filled: string; empty: string } {
  const n = Math.round((Math.min(100, Math.max(0, percent)) / 100) * cells)
  return { filled: '━'.repeat(n), empty: '─'.repeat(cells - n) }
}

export function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}
