import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export default function TaskAssignmentNotifications({ token }) {
  const [notifications, setNotifications] = useState([])
  const [connectionError, setConnectionError] = useState(false)

  useEffect(() => {
    const socket = io({ auth: { token } })
    const onAssignment = (notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 5))
      setConnectionError(false)
    }
    const onConnect = () => setConnectionError(false)

    socket.on('task:assigned', onAssignment)
    socket.on('connect', onConnect)
    socket.on('connect_error', () => setConnectionError(true))

    return () => {
      socket.off('task:assigned', onAssignment)
      socket.off('connect', onConnect)
      socket.disconnect()
    }
  }, [token])

  return (
    <section className="assignment-notifications" aria-label="Task assignment notifications">
      {connectionError && (
        <p className="assignment-connection-status" role="status">
          Live assignment alerts are unavailable. Refresh after reconnecting to try again.
        </p>
      )}
      {notifications.length > 0 && (
        <ul aria-live="polite" aria-relevant="additions">
          {notifications.map((notification, index) => (
            <li key={`${notification.taskId}-${notification.assignedAt}-${index}`}>
              <span><strong>Task assigned to you:</strong> {notification.title}</span>
              <button
                type="button"
                aria-label={`Dismiss notification for ${notification.title}`}
                onClick={() => setNotifications((current) => current.filter((item) => item !== notification))}
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
