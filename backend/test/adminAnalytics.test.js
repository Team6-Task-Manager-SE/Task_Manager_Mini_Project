const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.JWT_SECRET = "test-only-secret-for-admin-analytics";

const { createAccessToken } = require("../src/services/tokenService");
const { createAdminAnalyticsRepository } = require("../src/repositories/adminAnalyticsRepository");
const { createApp } = require("../src/app");

function tokenFor(role) {
  return createAccessToken({ id: role === "admin" ? 9001 : 9002, email: `${role}@example.test`, role });
}

const overview = {
  generatedAt: "2026-11-01T10:00:00.000Z",
  periodDays: 30,
  summary: {
    totalUsers: 10,
    newUsers: 2,
    activeUsers: 6,
    totalProjects: 1,
    totalTasks: 8,
    completedTasks: 3,
    recordedEvents: 14,
  },
  projects: [{
    id: "7",
    name: "Team workspace",
    createdAt: "2026-10-01T00:00:00.000Z",
    memberCount: 4,
    taskCount: 8,
    completedCount: 3,
    completionRate: 38,
  }],
};

test("admin analytics rejects anonymous requests", async () => {
  const app = createApp({ analytics: { getOverview: async () => overview } });
  const response = await request(app).get("/api/admin/analytics");
  assert.equal(response.status, 401);
});

test("admin analytics denies authenticated non-admin users", async () => {
  const app = createApp({ analytics: { getOverview: async () => overview } });
  const response = await request(app)
    .get("/api/admin/analytics")
    .set("Authorization", `Bearer ${tokenFor("user")}`);
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "FORBIDDEN");
});

test("admins can read aggregate account and project usage", async () => {
  const app = createApp({ analytics: { getOverview: async () => overview } });
  const response = await request(app)
    .get("/api/admin/analytics")
    .set("Authorization", `Bearer ${tokenFor("admin")}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.summary.activeUsers, 6);
  assert.equal(response.body.data.projects[0].memberCount, 4);
});

test("analytics repository maps database aggregates to numbers and rates", async () => {
  const pool = {
    async query(sql) {
      if (sql.includes("FROM projects p")) {
        return { rows: [{
          id: "7",
          name: "Team workspace",
          created_at: new Date("2026-10-01T00:00:00.000Z"),
          member_count: "4",
          task_count: "8",
          completed_count: "3",
        }] };
      }
      return { rows: [{
        total_users: "10",
        new_users_30d: "2",
        active_users_30d: "6",
        total_projects: "1",
        total_tasks: "8",
        completed_tasks: "3",
        recorded_events_30d: "14",
      }] };
    },
  };
  const result = await createAdminAnalyticsRepository(pool).getOverview();
  assert.equal(result.summary.totalUsers, 10);
  assert.equal(result.projects[0].memberCount, 4);
  assert.equal(result.projects[0].completionRate, 38);
});

