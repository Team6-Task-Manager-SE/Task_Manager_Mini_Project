
import { useCallback, useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export default function TaskComments({ taskId, token }) {
  const [comments, setComments] = useState([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const addComment = useCallback((comment) => {
    setComments((current) => {
      if (current.some((item) => item.id === comment.id)) {
        return current
      }

      return [...current, comment]
    })
  }, [])

  useEffect(() => {
    let active = true

    async function loadComments() {
      try {
        const response = await fetch(
          `/api/tasks/${taskId}/comments`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        const payload = await response.json()

        if (!response.ok) {
          throw new Error(payload.message || 'Unable to load comments')
        }

        if (active) {
          setComments(payload.data || [])
          setError('')
        }
      } catch (requestError) {
        if (active) setError(requestError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadComments()

    const socket = io({
      auth: { token },
    })

    socket.on('connect', () => {
      socket.emit('task:join', taskId, (result) => {
        if (!result?.success && active) {
          setError(result?.message || 'Unable to join comment updates')
        }
      })
    })

    socket.on('comment:new', (comment) => {
      if (active) addComment(comment)
    })

    socket.on('connect_error', () => {
      if (active) {
        setError('Live updates unavailable. You can still reload comments.')
      }
    })

    return () => {
      active = false
      socket.emit('task:leave', taskId)
      socket.disconnect()
    }
  }, [taskId, token, addComment])

  async function submitComment(event) {
    event.preventDefault()

    const trimmedContent = content.trim()

    if (!trimmedContent || sending) return

    setSending(true)
    setError('')

    try {
      const response = await fetch(
        `/api/tasks/${taskId}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: trimmedContent }),
        }
      )

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.message || 'Unable to add comment')
      }

      addComment(payload.data)
      setContent('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="task-comments">
      <h4>Comments</h4>

      {loading ? (
        <p>Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="comments-empty">No comments yet.</p>
      ) : (
        <ul className="comments-list">
          {comments.map((comment) => (
            <li key={comment.id}>
              <p>{comment.content}</p>
              <small>
                {new Date(comment.createdAt).toLocaleString()}
              </small>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submitComment} className="comment-form">
        <input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a comment..."
          maxLength={5000}
          aria-label="Write a comment"
          required
        />

        <button type="submit" disabled={sending || !content.trim()}>
          {sending ? 'Sending...' : 'Comment'}
        </button>
      </form>

      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
