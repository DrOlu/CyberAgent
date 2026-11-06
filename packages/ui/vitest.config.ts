import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // Animation-driven component tests (dialogs, etc.) exceed the 5s default
    // when CI runs many turbo tasks in parallel; apps/web and packages/views
    // already raise this for the same reason.
    testTimeout: 20_000,
  },
});
