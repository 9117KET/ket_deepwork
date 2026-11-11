import { describe, expect, it } from 'vitest'
import { attributedTaskOnDay } from './workSafety'

describe('attributedTaskOnDay: a block keeps its task only while the task exists on its day', () => {
  const day = [{ id: 't1' }, { id: 't2' }]

  it('keeps the task the block was worked against', () => {
    expect(attributedTaskOnDay('t1', day)).toBe('t1')
  })

  it('drops a task deleted mid-block, so the session is not left dangling', () => {
    expect(attributedTaskOnDay('gone', day)).toBeUndefined()
  })

  it('records an unattributed block as unattributed', () => {
    expect(attributedTaskOnDay(undefined, day)).toBeUndefined()
    expect(attributedTaskOnDay('t1', [])).toBeUndefined()
  })
})
