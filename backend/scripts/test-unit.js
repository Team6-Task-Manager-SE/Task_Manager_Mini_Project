const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const testDirectory = path.join(__dirname, "..", "test");
const databaseIntegrationTests = new Set([
  "projectInvitation.integration.test.js",
  "taskFeatures.test.js",
  "taskRepository.integration.test.js",
]);

const testFiles = fs.readdirSync(testDirectory)
  .filter((filename) => filename.endsWith(".test.js"))
  .filter((filename) => !databaseIntegrationTests.has(filename))
  .sort()
  .map((filename) => path.join(testDirectory, filename));

if (testFiles.length === 0) {
  console.error("No database-independent backend tests were found.");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--test", ...testFiles], {
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exitCode = 1;
  } else {
    process.exitCode = result.status ?? 1;
  }
}
