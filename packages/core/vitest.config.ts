import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ["@multica/vitest-setup/web-storage"],
    include: ["**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    // Performance-flavored tests (image-sequence, etc.) exceed the 5s default
    // when CI runs many turbo tasks in parallel; apps/web and packages/views
    // already raise this for the same reason.
    testTimeout: 20_000,
  },
});
