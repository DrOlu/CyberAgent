import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", ".source/**"],
    // Shared CI runners execute many turbo tasks in parallel; raise the 5s
    // default like apps/web and packages/views already do.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
