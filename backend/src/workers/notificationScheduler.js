
const {
  generateDueDateNotifications,
} = require("./dueDateNotificationWorker");

const {
  processOverdueEmailReminders,
} = require("./overdueEmailWorker");

function startNotificationScheduler(pool, options = {}) {
  const intervalMs = options.intervalMs || 5 * 60 * 1000;

  const overdueEmailService = options.emailService;

  let running = false;
  let stopped = false;

  async function checkNotifications() {
    if (running || stopped) {
      return;
    }

    running = true;

    try {
      const count = await generateDueDateNotifications(pool);

      console.log(
        `Notification check complete: ${count} new reminder(s).`
      );
    } catch (error) {
      console.error("Notification scheduler error:", error);
    }

    try {
      const result = overdueEmailService
        ? await processOverdueEmailReminders(
            pool,
            overdueEmailService
          )
        : await processOverdueEmailReminders(pool);

      console.log(
        "Overdue email check complete:",
        result
      );
    } catch (error) {
      console.error("Overdue email scheduler error:", error);
    } finally {
      running = false;
    }
  }

  // Run when the backend starts.
  void checkNotifications();

  // Repeat every five minutes.
  const timer = setInterval(() => {
    void checkNotifications();
  }, intervalMs);

  return function stopNotificationScheduler() {
    stopped = true;
    clearInterval(timer);
  };
}

module.exports = { startNotificationScheduler };
