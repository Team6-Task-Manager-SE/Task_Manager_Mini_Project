
import { useCallback, useEffect, useState } from 'react'
import NotificationsPanel from './components/NotificationsPanel'
import './App.css'

const initialLogin = { email: '', password: '' }

const initialRegistration = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
}

const PRIORITIES = ['low', 'medium', 'high']

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

function DashboardSummary({ summary }) {
  return (
    <section className="summary-grid" aria-label="Task summary">
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
            style={{ width: `${summary.completionRate}%` }}
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

function TaskWorkspace({ user, token, onLogout }) {
  const [tasks, setTasks] = useState([])
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

  // Schedule initial loading after the effect.
  // This avoids the React ESLint set-state-in-effect error.
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTasks()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadTasks])

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

  return (
    <main className="workspace-shell">
      <header className="workspace-header">
        <a
          className="brand dark"
          href="/"
          aria-label="Task Manager home"
        >
          <span className="brand-mark" aria-hidden="true">
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

      <section className="workspace-card">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">MY WORKSPACE</p>
            <h1>Your tasks</h1>
          </div>

          <span className="task-count">
            {tasks.length}{' '}
            {tasks.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        <DashboardSummary summary={summary} />

        {/* Sprint 2: Only one notification panel */}
        <NotificationsPanel token={token} />

        <form className="task-form" onSubmit={addTask}>
          <label htmlFor="new-task">Add a task</label>

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
                  <option key={item} value={item}>
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
          <p className="message success" role="status">
            {message}
          </p>
        )}

        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="empty-state">
            Loading your tasks…
          </p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
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
                    <strong>{task.title}</strong>
                    <span>{task.status}</span>

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
              </li>
            ))}
          </ul>
        )}

        {!loading && tasks.length === 0 && (
          <p className="empty-state">
            No tasks yet. Add your first one above.
          </p>
        )}
      </section>
    </main>
  )
}

function App() {
  const [mode, setMode] = useState('login')
  const [login, setLogin] = useState(initialLogin)
  const [registration, setRegistration] =
    useState(initialRegistration)

  const [user, setUser] = useState(null)

  const [token, setToken] = useState(() =>
    localStorage.getItem('taskManagerToken')
  )

  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const confirmationToken = new URLSearchParams(
      window.location.search
    ).get('confirm')

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

  if (user && token) {
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

          <h1>Turn plans into progress.</h1>

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
            <span>Today&apos;s progress</span>
            <strong>68%</strong>
          </div>

          <div className="progress-track">
            <span />
          </div>

          <div className="task-preview">
            <span className="check">✓</span>
            <span>Plan weekly sprint</span>
          </div>

          <div className="task-preview">
            <span className="check active" />
            <span>Review design system</span>
          </div>

          <div className="task-preview muted">
            <span className="check active" />
            <span>Ship authentication</span>
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
                : 'Create your account'}
            </h2>

            <p>
              {mode === 'login'
                ? 'Pick up where you left off.'
                : 'Start organizing your work in minutes.'}
            </p>
          </div>

          <div
            className="mode-switch"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              className={
                mode === 'login' ? 'active' : ''
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
                mode === 'register' ? 'active' : ''
              }
              type="button"
              onClick={() =>
                selectMode('register')
              }
            >
              Create account
            </button>
          </div>

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
            </form>
          ) : (
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
                      confirmPassword: event.target.value,
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
          )}

          <p className="security-note">
            <span aria-hidden="true">◆</span>
            Passwords are hashed and never
            stored in plain text.
          </p>
        </div>
      </section>
    </main>
  )
}

export default App
