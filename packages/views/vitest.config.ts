import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // The views suite includes heavy integration files (e.g. issue-detail,
    // 58 async tests rendering a full detail page over a mocked API) whose
    // waitFor/findBy polls finish well under 5s locally but, under CI runner
    // contention where turbo runs several packages' tests at once, can drift
    // past vitest's 5s default and flake. 20s keeps them stable without hiding
    // a genuinely hung test.
    testTimeout: 20000,
  },
});
