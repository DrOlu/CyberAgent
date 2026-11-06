import { resolve } from "path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src/renderer/src"),
    },
  },
  test: {
    globals: true,
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    passWithNoTests: true,
    // Long-running main-process and packaging tests exceed the 5s default when
    // CI runs many turbo tasks in parallel; apps/web and packages/views
    // already raise this for the same reason.
    testTimeout: 20_000,
  },
});
