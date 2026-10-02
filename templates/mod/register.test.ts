import { expect, test } from 'claude-code/testing'

test('/{{name}} answers', async $ => {
  const answer = await $.command.run({ command: '{{name}}', args: '' })
  expect(answer.text).toBe('Hello from {{name}}')
})
