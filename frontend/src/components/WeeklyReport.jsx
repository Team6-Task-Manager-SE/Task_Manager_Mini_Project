
import { useCallback, useEffect, useState } from 'react'

function getCurrentMonday() {
  const now = new Date()

  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  )

  const day = monday.getUTCDay()
  monday.setUTCDate(
    monday.getUTCDate() - ((day + 6) % 7)
  )

  return monday.toISOString().slice(0, 10)
}

export default function WeeklyReport({ token }) {
  const [week, setWeek] = useState(getCurrentMonday)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadReport = useCallback(async () => {
    setLoading(true)

    try {
      const response = await fetch(
        `/api/reports/weekly?week=${week}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload.message || 'Unable to load weekly report'
        )
      }

      setReport(payload.data)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [token, week])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadReport()
    }, 0)

    return () => clearTimeout(timer)
  }, [loadReport])

  function changeWeek(direction) {
    const date = new Date(`${week}T00:00:00.000Z`)
    date.setUTCDate(date.getUTCDate() + direction * 7)

    setWeek(date.toISOString().slice(0, 10))
  }

  return (
    <section className="weekly-report">
      <div className="weekly-report-header">
        <div>
          <h2>Weekly Productivity Report</h2>
          <p>Track your task progress every week.</p>
        </div>

        <div className="weekly-report-controls">
          <button
            type="button"
            onClick={() => changeWeek(-1)}
          >
            Previous
          </button>

          <span>Week of {week}</span>

          <button
            type="button"
            onClick={() => changeWeek(1)}
          >
            Next
          </button>
        </div>
      </div>

      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty-state">
          Loading weekly report...
        </p>
      ) : report ? (
        <div className="weekly-report-grid">
          <div className="weekly-report-card">
            <span>Tasks Created</span>
            <strong>{report.created}</strong>
          </div>

          <div className="weekly-report-card">
            <span>Tasks Completed</span>
            <strong>{report.completed}</strong>
          </div>

          <div className="weekly-report-card">
            <span>Completion Rate</span>
            <strong>{report.completionRate}%</strong>
          </div>

          <div className="weekly-report-card">
            <span>Currently Overdue</span>
            <strong>{report.currentlyOverdue}</strong>
          </div>
        </div>
      ) : (
        <p className="empty-state">
          No report available.
        </p>
      )}
    </section>
  )
}
