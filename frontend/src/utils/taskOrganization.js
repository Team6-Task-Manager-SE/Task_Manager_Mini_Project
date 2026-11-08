// Pure helpers for searching, filtering, and sorting the task list
// (TM-F-020 filtering, TM-F-021 sorting, TM-F-022 search).
//
// These live outside App.jsx so they can be unit tested without a browser.
// They never modify the array that is passed in, so sorting and filtering do
// not change the underlying task data.

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 }

// Converts a date value to a YYYY-MM-DD key in the user's local time zone.
// Returns '' when the value is missing or not a valid date.
export function localDateKey(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function organizeTasks(tasks, options = {}) {
  const {
    searchQuery = '',
    statusFilter = 'all',
    priorityFilter = 'all',
    categoryFilter = 'all',
    dueFromFilter = '',
    dueToFilter = '',
    sortOrder = 'created-desc',
  } = options

  const query = searchQuery.trim().toLocaleLowerCase()

  const filtered = tasks.filter((task) => {
    const matchesQuery = !query ||
      `${task.title || ''} ${task.description || ''}`.toLocaleLowerCase().includes(query)
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
    const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter
    const dueDate = localDateKey(task.dueDate)
    const matchesDueRange =
      (!dueFromFilter || Boolean(dueDate && dueDate >= dueFromFilter)) &&
      (!dueToFilter || Boolean(dueDate && dueDate <= dueToFilter))

    return matchesQuery && matchesStatus && matchesPriority && matchesCategory && matchesDueRange
  })

  const sorted = [...filtered]
  sorted.sort((left, right) => {
    if (sortOrder === 'due-asc') {
      const leftDue = localDateKey(left.dueDate) || '9999-12-31'
      const rightDue = localDateKey(right.dueDate) || '9999-12-31'
      return leftDue.localeCompare(rightDue) || left.title.localeCompare(right.title)
    }
    if (sortOrder === 'priority-desc') {
      return (PRIORITY_RANK[left.priority] ?? 3) - (PRIORITY_RANK[right.priority] ?? 3) ||
        right.createdAt.localeCompare(left.createdAt)
    }
    return right.createdAt.localeCompare(left.createdAt)
  })
  return sorted
}
