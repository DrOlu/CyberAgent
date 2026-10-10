// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigContext } from "expo/config";
import createConfig from "./app.config";

afterEach(() => vi.unstubAllEnvs());

describe("iOS scene lifecycle configuration", () => {
  it("resolves native presenters from the foregrounded scene", () => {
    const requireFromTest = createRequire(import.meta.url);
    const requireFromExpo = createRequire(requireFromTest.resolve("expo/package.json"));
    const modulesCoreRoot = dirname(
      requireFromExpo.resolve("expo-modules-core/package.json"),
    );
    const utilitiesRoot = join(modulesCoreRoot, "ios", "Utilities");
    const utilities = readFileSync(join(utilitiesRoot, "Utilities.swift"), "utf8");
    const sceneGeometry = readFileSync(
      join(utilitiesRoot, "SceneGeometry.swift"),
      "utf8",
    );

    // expo-modules-core 57.x resolved presenters with
    // `return SceneGeometry.keyWindow()` inside Utilities.swift; newer
    // releases moved the lookup back into Utilities.currentViewController()
    // (UIApplication.shared.keyWindow under MainActor.assumeIsolated) while
    // the scene-aware helper now lives in SceneGeometry.swift. Both layouts
    // provide a scene-capable presenter resolver — accept either, and require
    // SceneGeometry to keep its keyWindow lookup either way.
    const sceneAware =
      utilities.includes("SceneGeometry.keyWindow()") ||
      sceneGeometry.includes("static func keyWindow(");
    const legacyOnly =
      utilities.includes("UIApplication.shared.keyWindow?.rootViewController") &&
      !sceneGeometry.includes("keyWindow");

    expect(utilities).toContain("currentViewController()");
    expect(sceneAware).toBe(true);
    expect(legacyOnly).toBe(false);
  });

  it.each([
    [undefined, "Multica (Dev)", "ai.multica.mobile.dev"],
    ["development", "Multica (Dev)", "ai.multica.mobile.dev"],
    ["staging", "Multica (Staging)", "ai.multica.mobile.staging"],
    ["production", "Multica", "ai.multica.mobile"],
  ])("enables scene support for %s without changing app identity", (env, name, bundleIdentifier) => {
    vi.stubEnv("APP_ENV", env);
    vi.stubEnv("EXPO_BUNDLE_IDENTIFIER_DEV", undefined);
    vi.stubEnv("EXPO_BUNDLE_IDENTIFIER_STAGING", undefined);
    vi.stubEnv("EXPO_BUNDLE_IDENTIFIER_PROD", undefined);
    const config = createConfig({ config: {} } as ConfigContext);

    expect(config.name).toBe(name);
    expect(config.ios?.bundleIdentifier).toBe(bundleIdentifier);
    expect(config.scheme).toBe("multica");
    expect(config.plugins).toContainEqual([
      "expo-build-properties",
      { ios: { buildReactNativeFromSource: true, enableSceneSupport: true } },
    ]);
  });

  it.each([
    ["development", "com.example.multica.dev"],
    ["staging", "com.example.multica.staging"],
    ["production", "com.example.multica"],
  ])("preserves signing overrides for %s", (env, bundleIdentifier) => {
    vi.stubEnv("APP_ENV", env);
    vi.stubEnv("EXPO_BUNDLE_IDENTIFIER_DEV", "com.example.multica.dev");
    vi.stubEnv("EXPO_BUNDLE_IDENTIFIER_STAGING", "com.example.multica.staging");
    vi.stubEnv("EXPO_BUNDLE_IDENTIFIER_PROD", "com.example.multica");
    vi.stubEnv("EXPO_APPLE_TEAM_ID", "ABCDE12345");

    const config = createConfig({ config: {} } as ConfigContext);
    expect(config.ios).toMatchObject({ bundleIdentifier, appleTeamId: "ABCDE12345" });
    expect(config.scheme).toBe("multica");
  });
});
