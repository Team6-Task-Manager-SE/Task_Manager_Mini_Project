import { useEffect, useState } from 'react'
import './App.css'

const initialLogin = { email: '', password: '' }
const initialRegistration = { name: '', email: '', password: '', confirmPassword: '' }

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const validationMessage = payload.errors?.map((item) => item.message).join('. ')
    throw new Error(validationMessage || payload.message || 'Something went wrong')
  }
  return payload
}

function App() {
  const [mode, setMode] = useState('login')
  const [login, setLogin] = useState(initialLogin)
  const [registration, setRegistration] = useState(initialRegistration)
  const [user, setUser] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const confirmationToken = new URLSearchParams(window.location.search).get('confirm')
    if (confirmationToken) {
      apiRequest(`/api/auth/confirm-email?token=${encodeURIComponent(confirmationToken)}`)
        .then(() => {
          setNotice('Email confirmed. You can now sign in.')
          window.history.replaceState({}, '', window.location.pathname)
        })
        .catch((requestError) => setError(requestError.message))
    }

    const token = localStorage.getItem('taskManagerToken')
    if (token) {
      apiRequest('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((payload) => setUser(payload.data.user))
        .catch(() => localStorage.removeItem('taskManagerToken'))
    }
  }, [])

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
      const payload = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(login),
      })
      localStorage.setItem('taskManagerToken', payload.data.token)
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
    if (registration.password !== registration.confirmPassword) {
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
      setNotice('Account created. Check your email for the confirmation link, then sign in.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('taskManagerToken')
    setUser(null)
    setNotice('You have been signed out.')
  }

  return (
    <main className="app-shell">
      <section className="brand-panel" aria-label="Task Manager introduction">
        <a className="brand" href="/" aria-label="Task Manager home">
          <span className="brand-mark" aria-hidden="true">✓</span>
          <span>Task Manager</span>
        </a>
        <div className="brand-copy">
          <p className="eyebrow">FOCUS ON WHAT MATTERS</p>
          <h1>Turn plans into progress.</h1>
          <p className="lede">Organize your work, keep priorities clear, and move every project forward with your team.</p>
        </div>
        <div className="progress-card" aria-hidden="true">
          <div className="progress-heading"><span>Today&apos;s progress</span><strong>68%</strong></div>
          <div className="progress-track"><span /></div>
          <div className="task-preview"><span className="check">✓</span><span>Plan weekly sprint</span></div>
          <div className="task-preview"><span className="check active" /><span>Review design system</span></div>
          <div className="task-preview muted"><span className="check active" /><span>Ship authentication</span></div>
        </div>
        <p className="copyright">© 2026 Team 6 · PES University</p>
      </section>

      <section className="auth-panel">
        {user ? (
          <div className="welcome-card">
            <span className="success-icon" aria-hidden="true">✓</span>
            <p className="eyebrow">SIGNED IN</p>
            <h2>Welcome, {user.name}.</h2>
            <p>Your workspace is ready. Authentication and protected API access are working.</p>
            <dl>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Role</dt><dd>{user.role}</dd></div>
              <div><dt>Email status</dt><dd>{user.emailConfirmed ? 'Confirmed' : 'Pending confirmation'}</dd></div>
            </dl>
            <button className="primary-button" type="button" onClick={logout}>Sign out</button>
          </div>
        ) : (
          <div className="auth-card">
            <div className="auth-heading">
              <p className="eyebrow">WELCOME</p>
              <h2>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
              <p>{mode === 'login' ? 'Pick up where you left off.' : 'Start organizing your work in minutes.'}</p>
            </div>

            <div className="mode-switch" role="tablist" aria-label="Authentication mode">
              <button className={mode === 'login' ? 'active' : ''} type="button" onClick={() => selectMode('login')}>Sign in</button>
              <button className={mode === 'register' ? 'active' : ''} type="button" onClick={() => selectMode('register')}>Create account</button>
            </div>

            {notice && <p className="message success" role="status">{notice}</p>}
            {error && <p className="message error" role="alert">{error}</p>}

            {mode === 'login' ? (
              <form onSubmit={submitLogin}>
                <label>Email address<input type="email" autoComplete="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })} placeholder="you@example.com" required /></label>
                <label>Password<input type="password" autoComplete="current-password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} placeholder="Enter your password" required /></label>
                <button className="primary-button" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in'}</button>
              </form>
            ) : (
              <form onSubmit={submitRegistration}>
                <label>Full name<input type="text" autoComplete="name" value={registration.name} onChange={(event) => setRegistration({ ...registration, name: event.target.value })} placeholder="Your name" minLength="2" maxLength="120" required /></label>
                <label>Email address<input type="email" autoComplete="email" value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} placeholder="you@example.com" required /></label>
                <label>Password<input type="password" autoComplete="new-password" value={registration.password} onChange={(event) => setRegistration({ ...registration, password: event.target.value })} placeholder="8+ characters, mixed case and number" minLength="8" required /></label>
                <label>Confirm password<input type="password" autoComplete="new-password" value={registration.confirmPassword} onChange={(event) => setRegistration({ ...registration, confirmPassword: event.target.value })} placeholder="Repeat your password" minLength="8" required /></label>
                <button className="primary-button" disabled={loading} type="submit">{loading ? 'Creating account…' : 'Create account'}</button>
              </form>
            )}
            <p className="security-note"><span aria-hidden="true">◆</span> Passwords are encrypted and never stored in plain text.</p>
          </div>
        )}
      </section>
    </main>
  )
}

export default App
