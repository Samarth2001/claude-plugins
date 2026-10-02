import type { Register } from 'claude-code'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: '{{name}}', description: '{{description}}' })
    return next(e)
  })

  on('command.run', { command: '{{name}}' }, async () => {
    return { text: 'Hello from {{name}}' }
  })
}
