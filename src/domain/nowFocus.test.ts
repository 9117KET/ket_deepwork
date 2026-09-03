import { describe, expect, it } from 'vitest'
import { sectionsInPlay, selectNowFocus, summarizeSection } from './nowFocus'
import type { Task, TaskSectionId } from './types'

function task(id: string, sectionId: TaskSectionId, over: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    sectionId,
    date: '2026-09-02',
    isDone: false,
    ...over,
  }
}

describe('sectionsInPlay', () => {
  it('folds Top 3 in ahead of High Priority when the deep block is running', () => {
    expect(sectionsInPlay(['highPriority'])).toEqual(['mustDo', 'highPriority'])
  })

  it('leaves Top 3 out of blocks that are not the deep block', () => {
    expect(sectionsInPlay(['nightRoutine'])).toEqual(['nightRoutine'])
  })

  it('orders a multi-section block by the order of the day', () => {
    expect(sectionsInPlay(['lowPriority', 'mediumPriority'])).toEqual([
      'mediumPriority',
      'lowPriority',
    ])
  })

  it('drops side quests, which are never what the clock points at', () => {
    expect(sectionsInPlay(['sideQuest'])).toEqual([])
  })

  it('is empty when no block is running', () => {
    expect(sectionsInPlay([])).toEqual([])
  })
})

describe('selectNowFocus', () => {
  it('returns null while asleep, when no block is running', () => {
    expect(selectNowFocus([task('a', 'highPriority')], [])).toBeNull()
  })

  it('picks the first unfinished task in the running block', () => {
    const tasks = [
      task('done', 'highPriority', { isDone: true }),
      task('next', 'highPriority'),
      task('later', 'highPriority'),
    ]
    expect(selectNowFocus(tasks, ['highPriority'])).toEqual({
      kind: 'task',
      sectionId: 'highPriority',
      task: tasks[1],
    })
  })

  it('prefers a Top 3 task over High Priority during the deep block', () => {
    const tasks = [task('high', 'highPriority'), task('top', 'mustDo')]
    const focus = selectNowFocus(tasks, ['highPriority'])
    expect(focus).toMatchObject({ kind: 'task', sectionId: 'mustDo' })
  })

  it('ignores a section that is not in the running block', () => {
    const tasks = [task('night', 'nightRoutine')]
    expect(selectNowFocus(tasks, ['highPriority'])).toEqual({
      kind: 'clear',
      sectionId: 'highPriority',
    })
  })

  it('never points at a subtask', () => {
    const tasks = [task('sub', 'highPriority', { parentId: 'parent' })]
    expect(selectNowFocus(tasks, ['highPriority'])).toEqual({
      kind: 'clear',
      sectionId: 'highPriority',
    })
  })

  it('reports the block clear rather than disappearing when everything is done', () => {
    const tasks = [
      task('a', 'highPriority', { isDone: true }),
      task('b', 'mustDo', { isDone: true }),
    ]
    expect(selectNowFocus(tasks, ['highPriority'])).toEqual({
      kind: 'clear',
      sectionId: 'highPriority',
    })
  })

  it('names the block the clock points at when clear, not the folded-in Top 3', () => {
    const focus = selectNowFocus([], ['highPriority'])
    expect(focus).toEqual({ kind: 'clear', sectionId: 'highPriority' })
  })

  it('falls through a multi-section block to the section that has work', () => {
    const tasks = [task('low', 'lowPriority')]
    expect(selectNowFocus(tasks, ['mediumPriority', 'lowPriority'])).toMatchObject({
      kind: 'task',
      sectionId: 'lowPriority',
    })
  })
})

describe('summarizeSection', () => {
  it('counts top-level tasks and how many are done', () => {
    const tasks = [
      task('a', 'highPriority', { isDone: true }),
      task('b', 'highPriority'),
      task('c', 'nightRoutine'),
    ]
    expect(summarizeSection(tasks, 'highPriority')).toEqual({ total: 2, done: 1 })
  })

  it('excludes subtasks, which belong to their parent', () => {
    const tasks = [
      task('parent', 'highPriority'),
      task('child', 'highPriority', { parentId: 'parent' }),
    ]
    expect(summarizeSection(tasks, 'highPriority')).toEqual({ total: 1, done: 0 })
  })

  it('is empty for a section with nothing in it', () => {
    expect(summarizeSection([], 'lowPriority')).toEqual({ total: 0, done: 0 })
  })
})
