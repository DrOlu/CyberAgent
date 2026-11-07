import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    // fix-path v5 is ESM-only ("type": "module", exports has no "require"
    // condition). With plain externalization, `import fixPath from
    // "fix-path"` compiles to a bare CJS `require("fix-path")` and the
    // binding ends up holding the ESM module namespace object — not a
    // function — so the top-level fixPath() PATH-recovery call in
    // src/main/index.ts crashed every macOS/Linux launch with
    //   TypeError: fixPath is not a function
    // (Electron's "A JavaScript error occurred in the main process" dialog;
    // v1.5.x desktop releases were dead on arrival). Excluding it here
    // makes Rollup inline the ESM module into out/main/index.js and bind
    // the real default-export function instead. Guarded post-build by
    // scripts/check-main-bundle-esm-deps.mjs, which fails CI if any
    // ESM-only production dependency ever gets externalized again.
    plugins: [externalizeDepsPlugin({ exclude: ["fix-path"] })],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    server: {
      // Allow parallel worktrees to run `pnpm dev:desktop` side-by-side
      // (e.g. CyberAgent Canary alongside a primary checkout) by overriding
      // the renderer port via env. Falls back to 5173 for the common case.
      port: Number(process.env.DESKTOP_RENDERER_PORT) || 5173,
      strictPort: true,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": resolve("src/renderer/src"),
      },
      // Force every workspace package + nested dep to resolve these to a
      // single instance at bundle time. Without this, pnpm's per-package
      // peer-resolution can materialize two copies of a context-carrying
      // library when the workspace contains apps with different React
      // pins (e.g. apps/mobile's react-native pulls react@19.2.0 while
      // apps/desktop/web use 19.2.3). Vite then bundles both copies; the
      // QueryClient set by Provider A is invisible to useQueryClient()
      // from copy B, and the renderer crashes at module load with
      //   Uncaught Error: No QueryClient set, use QueryClientProvider...
      // (Reproduced in v1.5.0–v1.5.2 desktop builds — blank window on
      // launch.) The same hazard affects zustand stores and any other
      // React-context-based library. Keep this list in sync with the
      // React-state libraries the renderer consumes from @multica/*.
      dedupe: [
        "react",
        "react-dom",
        "@tanstack/react-query",
        "@tanstack/react-query-devtools",
        "@tanstack/react-table",
        "zustand",
        "react-router-dom",
        "react-router",
        "i18next",
        "react-i18next",
      ],
    },
  },
});
