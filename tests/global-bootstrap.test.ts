import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCurrentDashboardUrlPath } from "../src/global-bootstrap";

interface CustomCardEntry {
  type: string;
  name: string;
  description?: string;
  preview?: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var customCards: CustomCardEntry[] | undefined;
}

/**
 * `home-assistant` is a real (if minimal) custom element so
 * `document.querySelector("home-assistant")?.hass` — the bootstrap pattern
 * `initGlobalRegistration()` uses — has something real to find. Custom-element tags
 * can only ever be defined once per process, so this is defined once at module scope
 * (guarded) rather than per-test; individual tests instead create/append/remove their
 * own element instances.
 */
class FakeHomeAssistant extends HTMLElement {
  hass?: unknown;
}

if (!customElements.get("home-assistant")) {
  customElements.define("home-assistant", FakeHomeAssistant);
}

function makeHass(overrides: Record<string, unknown> = {}) {
  return {
    panels: {},
    connection: {
      subscribeEvents: vi.fn().mockResolvedValue(() => {}),
    },
    callWS: vi.fn(),
    ...overrides,
  };
}

function fullConfigWithLoader(dedicatedPicker?: boolean) {
  return {
    decluttering_templates: {
      T1: { card: { type: "x", entity: "[[entity]]" }, default: { entity: "light.t1" } },
    },
    views: [
      {
        cards: [
          {
            type: "custom:decluttering-selector",
            ...(dedicatedPicker !== undefined ? { dedicated_picker: dedicatedPicker } : {}),
          },
        ],
      },
    ],
  };
}

/**
 * `initGlobalRegistration()` is guarded (per the plan) so a second call within the
 * same module instance is a no-op — necessary in production so re-importing the
 * loader element module doesn't re-subscribe, but it means most tests here need a
 * *fresh* module instance to observe a first run. `vi.resetModules()` + a dynamic
 * `import()` gets a clean copy (including register.ts's own module-scope state) for
 * each test that needs one; the guard itself is tested separately, deliberately
 * reusing one instance across two calls.
 */
async function freshGlobalBootstrap() {
  vi.resetModules();
  return import("../src/global-bootstrap");
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  window.customCards = [];
  document.body.innerHTML = "";
});

afterEach(() => {
  // Defensive even when a test's own cleanup already ran: a leaked fake-timer
  // context here would make unrelated tests elsewhere in the suite hang or flake.
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("getCurrentDashboardUrlPath", () => {
  it('resolves the default dashboard via hass.panels even though the URL segment is also "lovelace"', () => {
    window.history.pushState({}, "", "/lovelace/0");
    const hass = { panels: { lovelace: { component_name: "lovelace" } } };
    expect(getCurrentDashboardUrlPath(hass as never)).toBe("lovelace");
  });

  it("resolves a named dashboard slug from the URL", () => {
    window.history.pushState({}, "", "/my-custom-dashboard/some-view");
    const hass = { panels: { "my-custom-dashboard": { component_name: "lovelace" } } };
    expect(getCurrentDashboardUrlPath(hass as never)).toBe("my-custom-dashboard");
  });

  it("skips a reverse-proxy path prefix that is not a lovelace panel", () => {
    window.history.pushState({}, "", "/proxy-prefix/my-dashboard/0");
    const hass = { panels: { "my-dashboard": { component_name: "lovelace" } } };
    expect(getCurrentDashboardUrlPath(hass as never)).toBe("my-dashboard");
  });

  it("falls back to the first path segment when hass.panels has no match", () => {
    window.history.pushState({}, "", "/unknown-dashboard/0");
    expect(getCurrentDashboardUrlPath(undefined)).toBe("unknown-dashboard");
  });

  it("returns undefined at the root path with no segments", () => {
    window.history.pushState({}, "", "/");
    expect(getCurrentDashboardUrlPath(undefined)).toBeUndefined();
  });

  it("handles a trailing slash the same as no trailing slash", () => {
    window.history.pushState({}, "", "/my-dashboard/0/");
    const hass = { panels: { "my-dashboard": { component_name: "lovelace" } } };
    expect(getCurrentDashboardUrlPath(hass as never)).toBe("my-dashboard");
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
  });
});

describe("initGlobalRegistration", () => {
  it("is a synchronous no-op scheduling no timers when no <home-assistant> element is present", async () => {
    vi.useFakeTimers();
    const { initGlobalRegistration } = await freshGlobalBootstrap();

    expect(document.querySelector("home-assistant")).toBeNull();
    expect(() => initGlobalRegistration()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });

  it("does not touch window.customCards when no <home-assistant> element is present", async () => {
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    initGlobalRegistration();
    await flushPromises();
    expect(window.customCards).toEqual([]);
  });

  it("registers per-template entries (not the dedicated-picker wrapper) once a <home-assistant> element with .hass already set is found, per the loader config's dedicated_picker: false/absent", async () => {
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    const home = document.createElement("home-assistant") as FakeHomeAssistant;
    const callWS = vi.fn().mockResolvedValue(fullConfigWithLoader(false));
    home.hass = makeHass({ callWS });
    document.body.appendChild(home);

    initGlobalRegistration();
    await flushPromises();

    expect(callWS).toHaveBeenCalled();
    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(
      false,
    );
    expect(window.customCards!.some((c) => c.type.startsWith("decluttering-card-"))).toBe(true);
  });

  it("registers only the dedicated-picker wrapper entry when the loader config's dedicated_picker is true", async () => {
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    const home = document.createElement("home-assistant") as FakeHomeAssistant;
    const callWS = vi.fn().mockResolvedValue(fullConfigWithLoader(true));
    home.hass = makeHass({ callWS });
    document.body.appendChild(home);

    initGlobalRegistration();
    await flushPromises();

    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(true);
    expect(window.customCards!.some((c) => c.type.startsWith("decluttering-card-"))).toBe(false);
  });

  it("does not register anything when the resolved config has no custom:decluttering-selector card anywhere (strictly opt-in)", async () => {
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    const home = document.createElement("home-assistant") as FakeHomeAssistant;
    const callWS = vi.fn().mockResolvedValue({
      decluttering_templates: { T1: { card: { type: "x" } } },
      views: [{ cards: [{ type: "some-other-card" }] }],
    });
    home.hass = makeHass({ callWS });
    document.body.appendChild(home);

    initGlobalRegistration();
    await flushPromises();

    expect(window.customCards).toEqual([]);
  });

  it("does not throw when resolving the config rejects", async () => {
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    const home = document.createElement("home-assistant") as FakeHomeAssistant;
    const callWS = vi.fn().mockRejectedValue(new Error("boom"));
    home.hass = makeHass({ callWS });
    document.body.appendChild(home);

    expect(() => initGlobalRegistration()).not.toThrow();
    await flushPromises();

    expect(window.customCards).toEqual([]);
  });

  it("eventually registers once .hass appears after a short delay via the bounded retry path", async () => {
    vi.useFakeTimers();
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    const home = document.createElement("home-assistant") as FakeHomeAssistant;
    document.body.appendChild(home);

    const callWS = vi.fn().mockResolvedValue(fullConfigWithLoader());

    initGlobalRegistration();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(400);
    expect(callWS).not.toHaveBeenCalled();

    home.hass = makeHass({ callWS });

    await vi.advanceTimersByTimeAsync(2000);

    expect(callWS).toHaveBeenCalled();
    expect(window.customCards!.some((c) => c.type.startsWith("decluttering-card-"))).toBe(true);

    vi.useRealTimers();
  });

  it("gives up silently, without throwing or leaving dangling timers, when .hass never appears within the retry budget", async () => {
    vi.useFakeTimers();
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    const home = document.createElement("home-assistant") as FakeHomeAssistant;
    document.body.appendChild(home);

    expect(() => initGlobalRegistration()).not.toThrow();

    await vi.advanceTimersByTimeAsync(3000);

    expect(vi.getTimerCount()).toBe(0);
    expect(window.customCards).toEqual([]);

    vi.useRealTimers();
  });

  it("does not double-subscribe or re-run setup when called a second time", async () => {
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    const home = document.createElement("home-assistant") as FakeHomeAssistant;
    const subscribeEvents = vi.fn().mockResolvedValue(() => {});
    const callWS = vi.fn().mockResolvedValue(fullConfigWithLoader());
    home.hass = makeHass({ connection: { subscribeEvents }, callWS });
    document.body.appendChild(home);

    initGlobalRegistration();
    await flushPromises();
    initGlobalRegistration();
    await flushPromises();

    expect(subscribeEvents).toHaveBeenCalledTimes(1);
  });

  it("does not duplicate window.customCards entries across the guarded second call", async () => {
    const { initGlobalRegistration } = await freshGlobalBootstrap();
    const home = document.createElement("home-assistant") as FakeHomeAssistant;
    const callWS = vi.fn().mockResolvedValue(fullConfigWithLoader(false));
    home.hass = makeHass({ callWS });
    document.body.appendChild(home);

    initGlobalRegistration();
    await flushPromises();
    initGlobalRegistration();
    await flushPromises();

    const matches = window.customCards!.filter((c) => c.type.startsWith("decluttering-card-"));
    expect(matches).toHaveLength(1);
  });
});
