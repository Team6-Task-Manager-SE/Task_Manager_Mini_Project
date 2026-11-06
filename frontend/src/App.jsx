
import { useCallback, useEffect, useState } from 'react'
import NotificationsPanel from './components/NotificationsPanel'
import WeeklyReport from './components/WeeklyReport'
import TaskComments from './components/TaskComments'
import TaskAssignmentNotifications from './components/TaskAssignmentNotifications'
import './App.css'

const initialLogin = {
  email: '',
  password: '',
}

const initialRegistration = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

const PRIORITIES = ['low', 'medium', 'high']
const BOARD_COLUMNS = [
  { id: 'todo', label: 'To do' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
]

const emptySummary = {
  total: 0,
  byStatus: {
    todo: 0,
    'in-progress': 0,
    completed: 0,
  },
  byPriority: {
    low: 0,
    medium: 0,
    high: 0,
  },
  overdue: 0,
  completionRate: 0,
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const validationMessage = payload.errors
      ?.map((item) => item.message)
      .join('. ')

    throw new Error(
      validationMessage ||
      payload.message ||
      'Something went wrong'
    )
  }

  return payload
}

function parseTags(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

// Sprint 1 - Task Dashboard
function DashboardSummary({ summary }) {
  return (
    <section
      className="summary-grid"
      aria-label="Task summary"
    >
      <div className="summary-card">
        <span>Total</span>
        <strong>{summary.total}</strong>
      </div>

      <div className="summary-card">
        <span>To do</span>
        <strong>{summary.byStatus.todo}</strong>
      </div>

      <div className="summary-card">
        <span>In progress</span>
        <strong>{summary.byStatus['in-progress']}</strong>
      </div>

      <div className="summary-card">
        <span>Completed</span>
        <strong>{summary.byStatus.completed}</strong>
      </div>

      <div className="summary-card warn">
        <span>Overdue</span>
        <strong>{summary.overdue}</strong>
      </div>

      <div className="summary-card wide">
        <span>
          Completion · {summary.completionRate}%
        </span>

        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={summary.completionRate}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span
            style={{
              width: `${summary.completionRate}%`,
            }}
          />
        </div>

        <small>
          High {summary.byPriority.high} ·
          Medium {summary.byPriority.medium} ·
          Low {summary.byPriority.low}
        </small>
      </div>
    </section>
  )
}

function AdminUsageAnalytics({ token }) {
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    apiRequest('/api/admin/analytics', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((payload) => {
        if (active) setOverview(payload.data)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [token])

  return (
    <section className="admin-analytics" aria-labelledby="admin-analytics-title">
      <div className="admin-analytics-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2 id="admin-analytics-title">Usage analytics</h2>
          <p>Account activity from the last 30 days and task activity by project.</p>
        </div>
        {overview && <small>Updated {new Date(overview.generatedAt).toLocaleString()}</small>}
      </div>

      {loading && <p className="empty-state" role="status">Loading analytics…</p>}
      {error && <p className="message error" role="alert">{error}</p>}
      {overview && (
        <>
          <div className="admin-analytics-grid">
            <div><span>Registered users</span><strong>{overview.summary.totalUsers}</strong></div>
            <div><span>Active users · 30 days</span><strong>{overview.summary.activeUsers}</strong></div>
            <div><span>New users · 30 days</span><strong>{overview.summary.newUsers}</strong></div>
            <div><span>Projects</span><strong>{overview.summary.totalProjects}</strong></div>
            <div><span>Tasks</span><strong>{overview.summary.totalTasks}</strong></div>
            <div><span>Completed tasks</span><strong>{overview.summary.completedTasks}</strong></div>
            <div><span>Recorded events · 30 days</span><strong>{overview.summary.recordedEvents}</strong></div>
          </div>

          <div className="admin-projects-heading">
            <h3>Project activity</h3>
            <span>Project membership is the app’s current team/workspace grouping.</span>
          </div>
          {overview.projects.length === 0 ? (
            <p className="empty-state">No project activity has been recorded yet.</p>
          ) : (
            <div className="admin-projects-scroll" role="region" aria-label="Project activity" tabIndex="0">
              <table className="admin-projects-table">
                <thead>
                  <tr><th scope="col">Project</th><th scope="col">Members</th><th scope="col">Tasks</th><th scope="col">Completed</th><th scope="col">Completion</th></tr>
                </thead>
                <tbody>
                  {overview.projects.map((project) => (
                    <tr key={project.id}>
                      <th scope="row">{project.name}</th>
                      <td>{project.memberCount}</td>
                      <td>{project.taskCount}</td>
                      <td>{project.completedCount}</td>
                      <td>{project.completionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}

// Main Task Manager Workspace
function TaskWorkspace({ user, token, onLogout }) {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')
  const [tagsInput, setTagsInput] = useState('')
  const [category, setCategory] = useState('')
  const [summary, setSummary] = useState(emptySummary)

  const [editingId, setEditingId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const authorizedRequest = useCallback(
    (path, options = {}) =>
      apiRequest(path, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      }),
    [token]
  )

  const loadTasks = useCallback(async () => {
    try {
      const [taskPayload, summaryPayload] =
        await Promise.all([
          authorizedRequest('/api/tasks'),
          authorizedRequest('/api/tasks/summary'),
        ])

      setTasks(taskPayload.data)
      setSummary(summaryPayload.data)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [authorizedRequest])

  const loadProjects = useCallback(async () => {
    try {
      const payload = await authorizedRequest('/api/projects')
      setProjects(payload.data)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [authorizedRequest])

  // Schedule initial loading asynchronously for React Hooks lint.
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTasks()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadTasks])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadProjects()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadProjects])

  async function addProject(event) {
    event.preventDefault()
    if (!projectName.trim()) return

    setError('')
    try {
      const payload = await authorizedRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim(),
        }),
      })
      setProjects((current) => [payload.data, ...current])
      setSelectedProjectId(String(payload.data.id))
      setProjectName('')
      setProjectDescription('')
      setMessage('Project created. Add tasks and move them across the board.')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function addTask(event) {
    event.preventDefault()

    if (!title.trim()) return

    setError('')

    try {
      await authorizedRequest('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          priority,
          tags: parseTags(tagsInput),
          category: category.trim(),
          projectId: selectedProjectId ? Number(selectedProjectId) : null,
        }),
      })

      setTitle('')
      setPriority('medium')
      setTagsInput('')
      setCategory('')
      setMessage('Task created successfully.')

      await loadTasks()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function saveTask(taskId) {
    if (!editingTitle.trim()) return

    setError('')

    try {
      await authorizedRequest(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editingTitle.trim(),
        }),
      })

      setEditingId(null)
      setMessage('Task updated successfully.')

      await loadTasks()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function changePriority(taskId, nextPriority) {
    setError('')

    try {
      await authorizedRequest(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          priority: nextPriority,
        }),
      })

      setMessage('Priority updated.')

      await loadTasks()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function deleteTask(taskId) {
    setError('')

    try {
      await authorizedRequest(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      })

      setMessage('Task deleted successfully.')

      await loadTasks()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function moveTask(taskId, nextStatus) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task || task.status === nextStatus) return

    setError('')
    try {
      await authorizedRequest(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      })
      setMessage(`Task moved to ${BOARD_COLUMNS.find((column) => column.id === nextStatus)?.label || nextStatus}.`)
      await loadTasks()
      await loadProjects()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const projectTasks = selectedProjectId
    ? tasks.filter((task) => String(task.projectId) === selectedProjectId)
    : tasks
  const selectedProject = projects.find((project) => String(project.id) === selectedProjectId)

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <a
          className="brand dark"
          href="/"
          aria-label="Task Manager home"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            ✓
          </span>

          <span>Task Manager</span>
        </a>

        <div className="user-actions">
          <span>
            {user.name} · {user.role}
          </span>

          <button
            className="secondary-button"
            type="button"
            onClick={onLogout}
          >
            Sign out
          </button>
        </div>
      </header>

      <TaskAssignmentNotifications token={token} />

      <section className="workspace-card">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">
              MY WORKSPACE
            </p>

            <h1>Your tasks</h1>
          </div>

          <span className="task-count">
            {tasks.length}{' '}
            {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {/* Sprint 1 - Dashboard Summary */}
        <DashboardSummary summary={summary} />

        {user.role === 'admin' && <AdminUsageAnalytics token={token} />}

        {/* Sprint 2 Issue #25 - Weekly Productivity Report */}
        <WeeklyReport token={token} />

        {/* Sprint 2 Issue #19 - Due-Date Notifications */}
        <NotificationsPanel token={token} />

        <section className="project-workspace" aria-labelledby="project-workspace-title">
          <div className="project-workspace-heading">
            <div>
              <p className="eyebrow">PROJECTS</p>
              <h2 id="project-workspace-title">Organize work by project</h2>
            </div>
            <label>
              Board
              <select
                aria-label="Select project board"
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.target.value)}
              >
                <option value="">All tasks</option>
                {projects.map((project) => (
                  <option key={project.id} value={String(project.id)}>{project.name}</option>
                ))}
              </select>
            </label>
          </div>

          <form className="project-create-form" onSubmit={addProject}>
            <label>
              New project
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="e.g. Semester project"
                maxLength="200"
                required
              />
            </label>
            <label>
              Description
              <input
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                placeholder="Optional project details"
                maxLength="5000"
              />
            </label>
            <button className="secondary-button" type="submit">Create project</button>
          </form>
        </section>

        {/* Sprint 1 - Task Creation */}
        <form
          className="task-form"
          onSubmit={addTask}
        >
          <label htmlFor="new-task">
            Add a task
          </label>

          <div>
            <input
              id="new-task"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="What needs to be done?"
              maxLength="200"
              required
            />

            <button
              className="primary-button"
              type="submit"
            >
              Add task
            </button>
          </div>

          <div className="task-meta-fields">
            <label>
              Priority

              <select
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value)
                }
              >
                {PRIORITIES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Category

              <input
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                placeholder="e.g. College"
                maxLength="50"
              />
            </label>

            <label>
              Tags (comma separated)

              <input
                value={tagsInput}
                onChange={(event) =>
                  setTagsInput(event.target.value)
                }
                placeholder="e.g. exam, urgent"
              />
            </label>
          </div>
        </form>

        {message && (
          <p
            className="message success"
            role="status"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            className="message error"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Sprint 1 - Task List */}
        {loading ? (
          <p className="empty-state">
            Loading your tasks…
          </p>
        ) : (
          selectedProjectId ? (
            <section className="kanban-board" aria-label={`${selectedProject?.name || 'Project'} Kanban board`}>
              {BOARD_COLUMNS.map((column) => {
                const columnTasks = projectTasks.filter((task) => task.status === column.id)
                return (
                  <section
                    className="kanban-column"
                    key={column.id}
                    aria-labelledby={`kanban-${column.id}-title`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault()
                      const taskId = Number(event.dataTransfer.getData('text/plain'))
                      if (Number.isSafeInteger(taskId)) void moveTask(taskId, column.id)
                    }}
                  >
                    <header>
                      <h3 id={`kanban-${column.id}-title`}>{column.label}</h3>
                      <span>{columnTasks.length}</span>
                    </header>
                    {columnTasks.length === 0 ? (
                      <p className="kanban-empty">Drop a task here</p>
                    ) : (
                      <ul>
                        {columnTasks.map((task) => (
                          <li
                            key={task.id}
                            draggable
                            onDragStart={(event) => event.dataTransfer.setData('text/plain', String(task.id))}
                          >
                            <strong>{task.title}</strong>
                            {task.description && <p>{task.description}</p>}
                            <div className="chips">
                              <em className={`chip priority-${task.priority}`}>{task.priority}</em>
                              {task.category && <em className="chip category">{task.category}</em>}
                            </div>
                            <label>
                              Move task
                              <select
                                aria-label={`Move ${task.title}`}
                                value={task.status}
                                onChange={(event) => void moveTask(task.id, event.target.value)}
                              >
                                {BOARD_COLUMNS.map((option) => (
                                  <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                )
              })}
            </section>
          ) : (
          <ul className="task-list">
            {projectTasks.map((task) => (
              <li key={task.id}>
                {editingId === task.id ? (
                  <input
                    className="edit-input"
                    value={editingTitle}
                    onChange={(event) =>
                      setEditingTitle(event.target.value)
                    }
                    maxLength="200"
                    autoFocus
                  />
                ) : (
                  <div className="task-copy">
                    <strong>
                      {task.title}
                    </strong>

                    <span>
                      {task.status}
                    </span>

                    <div className="chips">
                      <em
                        className={`chip priority-${task.priority}`}
                      >
                        {task.priority}
                      </em>

                      {task.category && (
                        <em className="chip category">
                          {task.category}
                        </em>
                      )}

                      {(task.tags || []).map((tag) => (
                        <em
                          key={tag}
                          className="chip tag"
                        >
                          #{tag}
                        </em>
                      ))}
                    </div>
                  </div>
                )}

                <div className="task-actions">
                  {editingId === task.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          saveTask(task.id)
                        }
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(null)
                        }
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        aria-label="Change priority"
                        value={task.priority}
                        onChange={(event) =>
                          changePriority(
                            task.id,
                            event.target.value
                          )
                        }
                      >
                        {PRIORITIES.map((item) => (
                          <option
                            key={item}
                            value={item}
                          >
                            {item}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(task.id)
                          setEditingTitle(task.title)
                        }}
                      >
                        Edit
                      </button>

                      <button
                        className="danger-button"
                        type="button"
                        onClick={() =>
                          deleteTask(task.id)
                        }
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>                             
                {task.projectId != null && (
                  <TaskComments
                    taskId={task.id}
                    token={token}
                  />
                )}
              </li>             
            ))}
          </ul>
          )
        )}

        {!loading && projectTasks.length === 0 && (
          <p className="empty-state">
            {selectedProjectId ? 'This project has no tasks yet. Add one above.' : 'No tasks yet. Add your first one above.'}
          </p>
        )}
      </section>
    </main>
  )
}

// Login and Registration
function App() {
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.search).has('reset')
      ? 'reset'
      : 'login'
  )
  const [login, setLogin] = useState(initialLogin)
  const [registration, setRegistration] =
    useState(initialRegistration)
  const [resetEmail, setResetEmail] = useState('')
  const [resetToken, setResetToken] = useState(() =>
    new URLSearchParams(window.location.search).get('reset') || ''
  )
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [user, setUser] = useState(null)

  const [token, setToken] = useState(() =>
    localStorage.getItem('taskManagerToken')
  )

  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const confirmationToken =
      query.get('confirm')

    if (confirmationToken) {
      apiRequest(
        `/api/auth/confirm-email?token=${encodeURIComponent(
          confirmationToken
        )}`
      )
        .then(() => {
          setNotice(
            'Email confirmed. You can now sign in.'
          )

          window.history.replaceState(
            {},
            '',
            window.location.pathname
          )
        })
        .catch((requestError) =>
          setError(requestError.message)
        )
    }

    if (token) {
      apiRequest('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((payload) =>
          setUser(payload.data.user)
        )
        .catch(() => {
          localStorage.removeItem('taskManagerToken')
          setToken(null)
          setUser(null)
        })
    }
  }, [token])

  function selectMode(nextMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  async function submitLogin(event) {
    event.preventDefault()

    setLoading(true)
    setError('')
    setNotice('')

    try {
      const payload = await apiRequest(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify(login),
        }
      )

      localStorage.setItem(
        'taskManagerToken',
        payload.data.token
      )

      setToken(payload.data.token)
      setUser(payload.data.user)
      setLogin(initialLogin)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')

    try {
      await apiRequest('/api/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email: resetEmail }),
      })
      setNotice('If an account exists for that email, a reset link has been sent.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitPasswordReset(event) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      await apiRequest('/api/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      })
      localStorage.removeItem('taskManagerToken')
      setToken(null)
      setUser(null)
      setMode('login')
      setResetToken('')
      setNewPassword('')
      setConfirmNewPassword('')
      window.history.replaceState({}, '', window.location.pathname)
      setNotice('Password updated. You can now sign in.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  function returnToSignIn() {
    setMode('login')
    setResetToken('')
    setNewPassword('')
    setConfirmNewPassword('')
    setError('')
    setNotice('')
    window.history.replaceState({}, '', window.location.pathname)
  }

  async function submitRegistration(event) {
    event.preventDefault()

    setError('')
    setNotice('')

    if (
      registration.password !==
      registration.confirmPassword
    ) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: registration.name,
          email: registration.email,
          password: registration.password,
        }),
      })

      setRegistration(initialRegistration)
      setMode('login')

      setNotice(
        'Account created. Check your email for the confirmation link, then sign in.'
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('taskManagerToken')

    setToken(null)
    setUser(null)

    setNotice('You have been signed out.')
  }

  const resetLinkIsOpen =
    new URLSearchParams(window.location.search).has('reset')

  if (user && token && !resetLinkIsOpen) {
    return (
      <TaskWorkspace
        user={user}
        token={token}
        onLogout={logout}
      />
    )
  }

  return (
    <main className="app-shell">
      <section
        className="brand-panel"
        aria-label="Task Manager introduction"
      >
        <a
          className="brand"
          href="/"
          aria-label="Task Manager home"
        >
          <span
            className="brand-mark"
            aria-hidden="true"
          >
            ✓
          </span>

          <span>Task Manager</span>
        </a>

        <div className="brand-copy">
          <p className="eyebrow">
            FOCUS ON WHAT MATTERS
          </p>

          <h1>
            Turn plans into progress.
          </h1>

          <p className="lede">
            Organize your work, keep priorities
            clear, and move every project forward
            with your team.
          </p>
        </div>

        <div
          className="progress-card"
          aria-hidden="true"
        >
          <div className="progress-heading">
            <span>
              Today&apos;s progress
            </span>

            <strong>68%</strong>
          </div>

          <div className="progress-track">
            <span />
          </div>

          <div className="task-preview">
            <span className="check">
              ✓
            </span>
            <span>
              Plan weekly sprint
            </span>
          </div>

          <div className="task-preview">
            <span className="check active" />
            <span>
              Review design system
            </span>
          </div>

          <div className="task-preview muted">
            <span className="check active" />
            <span>
              Ship authentication
            </span>
          </div>
        </div>

        <p className="copyright">
          © 2026 Team 6 · PES University
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-heading">
            <p className="eyebrow">
              WELCOME
            </p>

            <h2>
              {mode === 'login'
                ? 'Sign in to your account'
                : mode === 'register'
                  ? 'Create your account'
                  : mode === 'forgot'
                    ? 'Reset your password'
                    : 'Choose a new password'}
            </h2>

            <p>
              {mode === 'login'
                ? 'Pick up where you left off.'
                : mode === 'register'
                  ? 'Start organizing your work in minutes.'
                  : mode === 'forgot'
                    ? 'We’ll email you a secure link if the account exists.'
                    : 'Choose a new password for your account.'}
            </p>
          </div>

          {(mode === 'login' || mode === 'register') && <div
            className="mode-switch"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              className={
                mode === 'login'
                  ? 'active'
                  : ''
              }
              type="button"
              onClick={() =>
                selectMode('login')
              }
            >
              Sign in
            </button>

            <button
              className={
                mode === 'register'
                  ? 'active'
                  : ''
              }
              type="button"
              onClick={() =>
                selectMode('register')
              }
            >
              Create account
            </button>
          </div>}

          {notice && (
            <p
              className="message success"
              role="status"
            >
              {notice}
            </p>
          )}

          {error && (
            <p
              className="message error"
              role="alert"
            >
              {error}
            </p>
          )}

          {mode === 'login' ? (
            <form onSubmit={submitLogin}>
              <label>
                Email address

                <input
                  type="email"
                  autoComplete="email"
                  value={login.email}
                  onChange={(event) =>
                    setLogin({
                      ...login,
                      email: event.target.value,
                    })
                  }
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                Password

                <input
                  type="password"
                  autoComplete="current-password"
                  value={login.password}
                  onChange={(event) =>
                    setLogin({
                      ...login,
                      password: event.target.value,
                    })
                  }
                  placeholder="Enter your password"
                  required
                />
              </label>

              <button
                className="primary-button"
                disabled={loading}
                type="submit"
              >
                {loading
                  ? 'Signing in…'
                  : 'Sign in'}
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setResetEmail(login.email)
                  selectMode('forgot')
                }}
              >
                Forgot password?
              </button>
            </form>
          ) : mode === 'register' ? (
            <form onSubmit={submitRegistration}>
              <label>
                Full name

                <input
                  type="text"
                  autoComplete="name"
                  value={registration.name}
                  onChange={(event) =>
                    setRegistration({
                      ...registration,
                      name: event.target.value,
                    })
                  }
                  placeholder="Your name"
                  minLength="2"
                  maxLength="120"
                  required
                />
              </label>

              <label>
                Email address

                <input
                  type="email"
                  autoComplete="email"
                  value={registration.email}
                  onChange={(event) =>
                    setRegistration({
                      ...registration,
                      email: event.target.value,
                    })
                  }
                  placeholder="you@example.com"
                  required
                />
              </label>

              <label>
                Password

                <input
                  type="password"
                  autoComplete="new-password"
                  value={registration.password}
                  onChange={(event) =>
                    setRegistration({
                      ...registration,
                      password: event.target.value,
                    })
                  }
                  placeholder="8+ characters, mixed case and number"
                  minLength="8"
                  required
                />
              </label>

              <label>
                Confirm password

                <input
                  type="password"
                  autoComplete="new-password"
                  value={registration.confirmPassword}
                  onChange={(event) =>
                    setRegistration({
                      ...registration,
                      confirmPassword:
                        event.target.value,
                    })
                  }
                  placeholder="Repeat your password"
                  minLength="8"
                  required
                />
              </label>

              <button
                className="primary-button"
                disabled={loading}
                type="submit"
              >
                {loading
                  ? 'Creating account…'
                  : 'Create account'}
              </button>
            </form>
          ) : mode === 'forgot' ? (
            <form onSubmit={requestPasswordReset}>
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={resetEmail}
                  onChange={(event) => setResetEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <button className="text-button" type="button" onClick={returnToSignIn}>
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={submitPasswordReset}>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="8+ characters, mixed case and number"
                  minLength="8"
                  maxLength="128"
                  required
                />
              </label>
              <label>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  placeholder="Repeat your new password"
                  minLength="8"
                  maxLength="128"
                  required
                />
              </label>
              <button className="primary-button" disabled={loading} type="submit">
                {loading ? 'Updating…' : 'Update password'}
              </button>
              <button className="text-button" type="button" onClick={returnToSignIn}>
                Back to sign in
              </button>
            </form>
          )}

          <p className="security-note">
            <span aria-hidden="true">
              ◆
            </span>

            Passwords are hashed and never
            stored in plain text.
          </p>
        </div>
      </section>
    </main>
  )
}

export default App
