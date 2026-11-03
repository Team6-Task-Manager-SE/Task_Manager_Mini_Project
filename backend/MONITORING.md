# System Reliability and Uptime Monitoring

## Sprint 2 — Issue #28

### Objective

Monitor the Task Manager backend's availability and evaluate its performance against the monthly uptime target of 99.5%, excluding documented scheduled maintenance.

### Monitoring Implementation

The uptime monitor checks the backend health endpoint:

`GET /api/health`

The monitor runs independently of the backend and checks availability every 60 seconds.

Each observation records:
- Timestamp
- Availability status (UP or DOWN)
- HTTP status code
- Response time in milliseconds
- Connection or request errors

### Running the Monitor

From the `backend` directory:

```bash
node src/scripts/uptime-monitor.js
```

Observations are stored in:

`backend/monitoring-data/uptime-history.jsonl`

### Monthly Uptime Reports

Generate a monthly report using:

```bash
node src/scripts/monthly-uptime-report.js 2026-11
```

Reports include observed uptime percentage, monitoring coverage, successful checks, failed checks, missing checks, excluded maintenance checks, and target evaluation status.

The monitoring target is 99.5%.

### Scheduled Maintenance

Scheduled maintenance periods are declared in:

`backend/monitoring-maintenance.json`

Maintenance windows use UTC timestamps. Excluded maintenance periods are not counted as available or unavailable monitoring intervals.

Maintenance should be documented in advance.

### Reliability Testing

The monitoring system was tested by stopping and restarting the Task Manager backend.

The monitor recorded the sequence:

**UP → DOWN → UP**

This verified basic outage detection and recovery monitoring.

The monthly report and maintenance exclusion calculations are covered by automated tests.

### Limitations

- Monitoring runs only while the uptime-monitor process is active.
- A local development monitor does not demonstrate production availability.
- Missing observations are reported separately and are not considered successful checks.
- The uptime calculation is based on sampled observations, not continuous second-by-second availability.
- A monthly target cannot be conclusively evaluated without sufficient monitoring coverage.
- Independent hosted monitoring is recommended for deployed applications.

### November 2026 Test Observation

The initial monthly report produced:

- Observed uptime: 90%
- Monitoring coverage: 0.32%
- Successful checks: 9
- Failed checks: 1
- Missing checks: 3,122
- Status: INSUFFICIENT_DATA

These values represent an early local test and are not the final monthly reliability results.

### Conclusion

The Task Manager now supports basic automated availability checks, persistent observation logging, downtime and recovery detection, scheduled-maintenance exclusions, and monthly uptime reporting.

The functionality has been implemented and tested. Verification of the 99.5% monthly uptime target requires sustained monitoring of a deployed application.