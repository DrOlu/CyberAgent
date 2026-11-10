import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import BalancedSequencer from "./test/balanced-sequencer";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    sequence: { sequencer: BalancedSequencer },
    // setup.ts raises RTL's asyncUtilTimeout to 5s (CI contention flake fix).
    // Tests that assert a findBy* lookup REJECTS — e.g. thinking-prop-row's
    // MUL-7412 "row must never appear" — only pass if that rejection lands
    // inside vitest's test window, so testTimeout must stay strictly above
    // asyncUtilTimeout. 20s also leaves headroom for slow lookups under turbo
    // parallel load, which were getting killed at exactly 5s in CI.
    testTimeout: 20_000,
  },
});
