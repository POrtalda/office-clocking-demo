module.exports = {
  testEnvironment: "node",
  verbose: true,
  testMatch: ["**/tests/**/*.test.js"],
  clearMocks: true,
  setupFiles: ["<rootDir>/tests/setup.js"],
};