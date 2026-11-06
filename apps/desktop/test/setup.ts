import { configure } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "@multica/vitest-setup/web-storage";

// findBy*/waitFor default to a 1s poll budget. Under CI runner contention
// (turbo runs many packages' suites at once) even simple mounts can take
// longer, which flakes element lookups long before vitest's testTimeout
// fires. Give async queries a 5s budget.
configure({ asyncUtilTimeout: 5_000 });

// Everything below patches gaps in jsdom. Pure-logic suites opt out of jsdom
// with `// @vitest-environment node` and share this file, so there is no DOM to
// patch there — bail out rather than guard each stub.
if (typeof window !== "undefined") {
  // jsdom doesn't provide matchMedia; the sidebar's compact breakpoint and
  // auto-collapse band both read it. Nothing matches, so a shell mounted here
  // renders at its full desktop width. Mirrors packages/views/test/setup.ts.
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
}
