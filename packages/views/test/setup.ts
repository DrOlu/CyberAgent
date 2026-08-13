import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

if (typeof globalThis.localStorage?.clear !== "function") {
  const storage = createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}

// jsdom doesn't provide matchMedia; useIsMobile() relies on it.
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

// jsdom doesn't provide ResizeObserver; stub it so components that rely on it
// (e.g. input-otp) can render in tests.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// jsdom doesn't implement elementFromPoint; input-otp uses it internally.
if (typeof document.elementFromPoint !== "function") {
  document.elementFromPoint = () => null;
}

// jsdom has no layout, so it doesn't implement scrollIntoView; list components
// that keep a keyboard cursor in view (e.g. the thread navigator) call it.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

// Third-party schedulers (notably @tanstack/virtual-core's batched
// `maybeNotify`) post `setTimeout` calls that are not always cancelled on
// unmount. When one fires after vitest tears down this file's jsdom
// environment, React's `resolveUpdatePriority` reads `window` — now
// undefined — and throws "ReferenceError: window is not defined", failing
// the run even though every test passed. Track every `setTimeout` and clear
// whatever is still pending after each test so no timer outlives the
// environment that created it. (No views test uses fake timers, so this shim
// is never displaced by vi.useFakeTimers.)
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
const nativeSetTimeout = globalThis.setTimeout.bind(globalThis);
const nativeClearTimeout = globalThis.clearTimeout.bind(globalThis);

globalThis.setTimeout = ((
  handler: Parameters<typeof nativeSetTimeout>[0],
  timeout?: Parameters<typeof nativeSetTimeout>[1],
  ...args: unknown[]
) => {
  const id = nativeSetTimeout(handler, timeout, ...args);
  pendingTimers.add(id);
  return id;
}) as typeof setTimeout;

globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
  pendingTimers.delete(id);
  return nativeClearTimeout(id);
}) as typeof clearTimeout;

afterEach(() => {
  for (const id of pendingTimers) nativeClearTimeout(id);
  pendingTimers.clear();
});