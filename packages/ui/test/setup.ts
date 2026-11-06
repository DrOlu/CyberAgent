import { afterEach } from "vitest";
import { configure } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import "@multica/vitest-setup/web-storage";

// findBy*/waitFor default to a 1s poll budget. Under CI runner contention
// (turbo runs many packages' suites at once) even simple mounts can take
// longer, which flakes element lookups long before vitest's testTimeout
// fires. Give async queries a 5s budget.
configure({ asyncUtilTimeout: 5_000 });

// jsdom ships neither class. use-scroll-fade observes both.
const roInstances: ResizeObserverStub[] = [];

class ResizeObserverStub implements ResizeObserver {
  static triggerAll(): void {
    for (const instance of [...roInstances]) instance.callback([], instance);
  }

  constructor(private readonly callback: ResizeObserverCallback) {
    roInstances.push(this);
  }

  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = ResizeObserverStub;
}

// jsdom never runs its own frame loop. Queue callbacks so tests can inspect
// exactly how many frames are pending and flush one batch at a time.
const rafQueue: FrameRequestCallback[] = [];
globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
  rafQueue.push(cb);
  return rafQueue.length;
};
globalThis.cancelAnimationFrame = (handle: number): void => {
  const index = handle - 1;
  if (index >= 0 && index < rafQueue.length) rafQueue[index] = null as unknown as FrameRequestCallback;
};
globalThis.flushRaf = (): void => {
  const pending = rafQueue.splice(0, rafQueue.length);
  for (const cb of pending) cb?.(performance.now());
};
globalThis.pendingRaf = (): number =>
  rafQueue.filter((cb) => typeof cb === "function").length;

declare global {
  var flushRaf: () => void;
  var pendingRaf: () => number;
  var triggerResizeObservers: () => void;
}

globalThis.triggerResizeObservers = ResizeObserverStub.triggerAll;

afterEach(() => {
  rafQueue.length = 0;
  roInstances.length = 0;
});
