/** Jest config for a native ESM ("type": "module") project.
 * Run via `npm test`, which sets NODE_OPTIONS=--experimental-vm-modules. */
export default {
  testEnvironment: "node",
  transform: {},
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  setupFiles: ["<rootDir>/tests/setupEnv.js"],
};
