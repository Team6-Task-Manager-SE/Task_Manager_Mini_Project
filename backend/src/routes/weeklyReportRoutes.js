
const express = require("express");
const authenticate = require("../middleware/authenticate");
const authorizeRoles = require("../middleware/authorizeRoles");

function getMondayUTC(date) {
  const monday = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

  const day = monday.getUTCDay();
  const difference = (day + 6) % 7;

  monday.setUTCDate(monday.getUTCDate() - difference);

  return monday;
}

function createWeeklyReportRouter({ reports }) {
  const router = express.Router();

  router.use(authenticate);
  router.use(authorizeRoles("user", "admin"));

  router.get("/weekly", async (req, res, next) => {
    try {
      let monday;

      if (req.query.week !== undefined) {
        const week = req.query.week;

        if (
          typeof week !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(week)
        ) {
          return res.status(400).json({
            status: "error",
            message: "Week must use YYYY-MM-DD format",
          });
        }

        const parsed = new Date(`${week}T00:00:00.000Z`);

        if (
          Number.isNaN(parsed.getTime()) ||
          parsed.toISOString().slice(0, 10) !== week ||
          parsed.getUTCDay() !== 1
        ) {
          return res.status(400).json({
            status: "error",
            message: "Week must be a valid Monday date",
          });
        }

        monday = parsed;
      } else {
        monday = getMondayUTC(new Date());
      }

      const followingMonday = new Date(monday);
      followingMonday.setUTCDate(
        followingMonday.getUTCDate() + 7
      );

      const data = await reports.getWeeklyReport(
        req.user.id,
        monday.toISOString(),
        followingMonday.toISOString()
      );

      return res.status(200).json({
        status: "success",
        data,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createWeeklyReportRouter;
