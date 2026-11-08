// Unit tests for TM-F-020 (filtering), TM-F-021 (sorting) and TM-F-022 (search).
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { localDateKey, organizeTasks } from './taskOrganization.js'

// Dates are written without a "Z" so they are read as local time. That keeps
// these tests passing in every time zone.
const sampleTasks = () => [
  {
    id: 1,
    title: 'Write report',
    description: 'Quarterly numbers for the team',
    status: 'todo',
    priority: 'high',
    category: 'Work',
    dueDate: '2026-11-10T12:00:00',
    createdAt: '2026-11-01T09:00:00',
  },
  {
    id: 2,
    title: 'Buy groceries',
    description: 'Milk, eggs and bread',
    status: 'in-progress',
    priority: 'low',
    category: 'Home',
    dueDate: '2026-11-05T12:00:00',
    createdAt: '2026-11-02T09:00:00',
  },
  {
    id: 3,
    title: 'Study for exam',
    description: null,
    status: 'completed',
    priority: 'medium',
    category: 'College',
    dueDate: '2026-11-20T12:00:00',
    createdAt: '2026-11-03T09:00:00',
  },
  {
    id: 4,
    title: 'Plan trip',
    description: 'Look at flights',
    status: 'todo',
    priority: 'medium',
    category: 'Home',
    dueDate: null,
    createdAt: '2026-11-04T09:00:00',
  },
]

const ids = (tasks) => tasks.map((task) => task.id)

// ---------------------------------------------------------------- helpers
test('localDateKey returns a YYYY-MM-DD key and empty string for bad input', () => {
  assert.equal(localDateKey('2026-11-10T12:00:00'), '2026-11-10')
  assert.equal(localDateKey(null), '')
  assert.equal(localDateKey(''), '')
  assert.equal(localDateKey('not a date'), '')
})

// ------------------------------------------------ #15 Filtering (TC-Org-01)
test('#15 with no filters every task is shown', () => {
  assert.equal(organizeTasks(sampleTasks()).length, 4)
})

test('#15 users can filter tasks by status', () => {
  const result = organizeTasks(sampleTasks(), { statusFilter: 'todo' })
  assert.deepEqual(ids(result).sort(), [1, 4])
  assert.ok(result.every((task) => task.status === 'todo'))
})

test('#15 users can filter tasks by priority', () => {
  const result = organizeTasks(sampleTasks(), { priorityFilter: 'medium' })
  assert.deepEqual(ids(result).sort(), [3, 4])
})

test('#15 users can filter tasks by category', () => {
  const result = organizeTasks(sampleTasks(), { categoryFilter: 'Home' })
  assert.deepEqual(ids(result).sort(), [2, 4])
})

test('#15 users can filter tasks by a due date range', () => {
  const from = organizeTasks(sampleTasks(), { dueFromFilter: '2026-11-10' })
  assert.deepEqual(ids(from).sort(), [1, 3])

  const to = organizeTasks(sampleTasks(), { dueToFilter: '2026-11-10' })
  assert.deepEqual(ids(to).sort(), [1, 2])

  const both = organizeTasks(sampleTasks(), {
    dueFromFilter: '2026-11-06',
    dueToFilter: '2026-11-15',
  })
  assert.deepEqual(ids(both), [1])
})

test('#15 due date range includes the boundary days', () => {
  const result = organizeTasks(sampleTasks(), {
    dueFromFilter: '2026-11-05',
    dueToFilter: '2026-11-05',
  })
  assert.deepEqual(ids(result), [2])
})

test('#15 tasks with no due date are left out when a due date range is set', () => {
  const result = organizeTasks(sampleTasks(), { dueFromFilter: '2026-01-01' })
  assert.ok(!ids(result).includes(4))
})

test('#15 filtered results match every selected criterion', () => {
  const result = organizeTasks(sampleTasks(), {
    statusFilter: 'todo',
    categoryFilter: 'Home',
  })
  assert.deepEqual(ids(result), [4])

  const none = organizeTasks(sampleTasks(), {
    statusFilter: 'completed',
    priorityFilter: 'high',
  })
  assert.deepEqual(none, [])
})

test('#15 users can clear filters to see the unfiltered list', () => {
  const tasks = sampleTasks()
  const filtered = organizeTasks(tasks, { statusFilter: 'todo', priorityFilter: 'high' })
  assert.equal(filtered.length, 1)

  const cleared = organizeTasks(tasks, {
    searchQuery: '',
    statusFilter: 'all',
    priorityFilter: 'all',
    categoryFilter: 'all',
    dueFromFilter: '',
    dueToFilter: '',
  })
  assert.equal(cleared.length, tasks.length)
})

// -------------------------------------------------- #16 Sorting (TC-Org-02)
test('#16 tasks sort by creation date, newest first, by default', () => {
  assert.deepEqual(ids(organizeTasks(sampleTasks())), [4, 3, 2, 1])
  assert.deepEqual(
    ids(organizeTasks(sampleTasks(), { sortOrder: 'created-desc' })),
    [4, 3, 2, 1]
  )
})

test('#16 tasks sort by due date, earliest first, with no-date tasks last', () => {
  const result = organizeTasks(sampleTasks(), { sortOrder: 'due-asc' })
  assert.deepEqual(ids(result), [2, 1, 3, 4])
})

test('#16 tasks with the same due date are ordered by title', () => {
  const tasks = [
    { id: 1, title: 'Banana', dueDate: '2026-11-10T12:00:00', createdAt: '2026-11-01T09:00:00' },
    { id: 2, title: 'Apple', dueDate: '2026-11-10T12:00:00', createdAt: '2026-11-02T09:00:00' },
  ]
  assert.deepEqual(ids(organizeTasks(tasks, { sortOrder: 'due-asc' })), [2, 1])
})

test('#16 tasks sort by priority, high to low, newest first within a priority', () => {
  const result = organizeTasks(sampleTasks(), { sortOrder: 'priority-desc' })
  // high (1), medium newest first (4 then 3), low (2)
  assert.deepEqual(ids(result), [1, 4, 3, 2])
})

test('#16 a task with an unknown priority is sorted last', () => {
  const tasks = [
    ...sampleTasks(),
    { id: 5, title: 'Odd one', priority: 'urgent', createdAt: '2026-11-05T09:00:00' },
  ]
  const result = organizeTasks(tasks, { sortOrder: 'priority-desc' })
  assert.equal(result.at(-1).id, 5)
})

test('#16 sorting does not modify the underlying task data', () => {
  const tasks = sampleTasks()
  const before = JSON.stringify(tasks)

  const sorted = organizeTasks(tasks, { sortOrder: 'priority-desc' })

  assert.notStrictEqual(sorted, tasks)
  assert.equal(JSON.stringify(tasks), before)
  assert.deepEqual(ids(tasks), [1, 2, 3, 4])
})

test('#16 filtering does not modify the underlying task data', () => {
  const tasks = sampleTasks()
  const before = JSON.stringify(tasks)

  organizeTasks(tasks, { statusFilter: 'todo', searchQuery: 'plan' })

  assert.equal(JSON.stringify(tasks), before)
})

// ------------------------------------------------- #17 Search (TC-Org-03)
test('#17 search matches task titles', () => {
  const result = organizeTasks(sampleTasks(), { searchQuery: 'groceries' })
  assert.deepEqual(ids(result), [2])
})

test('#17 search matches task descriptions', () => {
  const result = organizeTasks(sampleTasks(), { searchQuery: 'flights' })
  assert.deepEqual(ids(result), [4])
})

test('#17 search is not case sensitive', () => {
  assert.deepEqual(ids(organizeTasks(sampleTasks(), { searchQuery: 'WRITE REPORT' })), [1])
  assert.deepEqual(ids(organizeTasks(sampleTasks(), { searchQuery: 'mILK' })), [2])
})

test('#17 search ignores spaces around the keyword', () => {
  const result = organizeTasks(sampleTasks(), { searchQuery: '   exam   ' })
  assert.deepEqual(ids(result), [3])
})

test('#17 a blank search shows all tasks', () => {
  assert.equal(organizeTasks(sampleTasks(), { searchQuery: '   ' }).length, 4)
})

test('#17 a keyword with no match returns no tasks', () => {
  assert.deepEqual(organizeTasks(sampleTasks(), { searchQuery: 'zzz-no-match' }), [])
})

test('#17 search does not fail on tasks with a missing description', () => {
  // Task 3 has a null description.
  const result = organizeTasks(sampleTasks(), { searchQuery: 'study' })
  assert.deepEqual(ids(result), [3])
})

test('#17 search works together with filters and sorting', () => {
  const result = organizeTasks(sampleTasks(), {
    searchQuery: 'a',
    statusFilter: 'todo',
    sortOrder: 'due-asc',
  })
  // "a" appears in "Plan trip" and "Write report"'s description ("team").
  // Both are todo; due-asc puts the dated task before the undated one.
  assert.deepEqual(ids(result), [1, 4])
})
