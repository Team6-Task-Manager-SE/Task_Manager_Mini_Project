import { useEffect, useState } from 'react'

const API = 'http://localhost:5000/api/tasks'

function App() {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')

  const loadTasks = async () => {
    try {
      const res = await fetch(API)
      const json = await res.json()
      setTasks(json.data)
    } catch {
      setMessage('Could not reach the backend')
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const addTask = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    setTitle('')
    loadTasks()
  }

  const deleteTask = async (id) => {
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
    const json = await res.json()
    setMessage(json.message)
    loadTasks()
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'left' }}>
      <h1>Task Manager</h1>

      <form onSubmit={addTask} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task title"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit">Add</button>
      </form>

      {message && <p>{message}</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {tasks.map((task) => (
          <li
            key={task.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: 10,
              borderBottom: '1px solid #444',
            }}
          >
            <span>{task.title} ({task.status})</span>
            <button onClick={() => deleteTask(task.id)}>Delete</button>
          </li>
        ))}
      </ul>

      {tasks.length === 0 && <p>No tasks left.</p>}
    </div>
  )
}

export default App
