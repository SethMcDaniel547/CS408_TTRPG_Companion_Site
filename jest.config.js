"use strict";

// Jest configuration. Backend tests are plain Node (CommonJS); no transform is
// needed. Two projects keep the fast unit suite separate from the slower,
// Docker-backed repository integration suite (architecture testing rules 1 & 2):
//
//   npm test              -> unit only (no Docker, always runnable)
//   npm run test:integration -> integration only (needs the test database)
//   npm run test:all      -> both
//
// Select a single project directly with: jest --selectProjects unit
module.exports = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      testRunner: "jest-circus/runner",
      testMatch: ["**/backend/__tests__/**/*.test.js"],
      testPathIgnorePatterns: ["/node_modules/", "/integration/"],
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      testRunner: "jest-circus/runner",
      testMatch: ["**/backend/__tests__/integration/**/*.test.js"],
      globalSetup: "<rootDir>/backend/__tests__/integration/globalSetup.js",
      globalTeardown: "<rootDir>/backend/__tests__/integration/globalTeardown.js",
    },
  ],
};
