
const {
    generateDueDateNotifications,
  } = require("./dueDateNotificationWorker");

  function startNotificationScheduler(pool) {
    async function checkDueDates() {
      try {
        const count = await generateDueDateNotifications(pool);

        console.log(
          `Notification check complete: ${count} new reminder(s).`
        );
      } catch (error) {
        console.error("Notification scheduler error:", error);
      }
    }

    // Check immediately when the backend starts.
    void checkDueDates();

    // Check every five minutes.
    const timer = setInterval(checkDueDates, 5 * 60 * 1000);

    return () => clearInterval(timer);
  }

  module.exports = { startNotificationScheduler };
