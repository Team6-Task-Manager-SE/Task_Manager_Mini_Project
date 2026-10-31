
import { useCallback, useEffect, useState } from 'react'

export default function NotificationsPanel({ token }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          payload.message || 'Failed to load notifications'
        )
      }

      setNotifications(payload.notifications || [])
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  // Initial loading is scheduled asynchronously.
  // Notifications are refreshed every 60 seconds.
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void loadNotifications()
    }, 0)

    const refreshTimer = setInterval(() => {
      void loadNotifications()
    }, 60 * 1000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(refreshTimer)
    }
  }, [loadNotifications])

  async function markAsRead(id) {
    setUpdatingId(id)

    try {
      const response = await fetch(
        `/api/notifications/${id}/read`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(
          payload.message || 'Unable to update notification'
        )
      }

      setNotifications((current) =>
        current.map((notification) =>
          String(notification.id) === String(id)
            ? {
                ...notification,
                is_read: true,
              }
            : notification
        )
      )

      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.is_read
  ).length

  return (
    <section
      className="notifications-panel"
      aria-label="Due-date notifications"
    >
      <div className="notifications-heading">
        <div>
          <h2>Due-date reminders</h2>
          <p>
            Stay updated on upcoming task deadlines.
          </p>
        </div>

        <div className="notifications-controls">
          <span className="unread-count">
            {unreadCount} unread
          </span>

          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadNotifications()}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="notification-empty">
          Loading notifications...
        </p>
      ) : notifications.length === 0 ? (
        <p className="notification-empty">
          No due-date reminders yet.
        </p>
      ) : (
        <ul className="notifications-list">
          {notifications.map((notification) => (
            <li
              key={notification.id}
              className={
                notification.is_read
                  ? 'notification-item read'
                  : 'notification-item unread'
              }
            >
              <div className="notification-content">
                <p>{notification.message}</p>

                <small>
                  {new Date(
                    notification.created_at
                  ).toLocaleString()}
                </small>
              </div>

              {!notification.is_read ? (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={updatingId === notification.id}
                  onClick={() =>
                    void markAsRead(notification.id)
                  }
                >
                  {updatingId === notification.id
                    ? 'Updating...'
                    : 'Mark as read'}
                </button>
              ) : (
                <span className="notification-read-label">
                  Read
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
