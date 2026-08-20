import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import "../src/decluttering-selector";
import { getCurrentDashboardUrlPath } from "../src/decluttering-selector";
import { safeTagName } from "../src/decluttering";
import { getRegisteredMetas } from "../src/register";
import type { DeclutteringTemplate, DeclutteringTemplates } from "../src/types";

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

type SelectorElement = HTMLElement & {
  hass?: unknown;
  setConfig?: (config: unknown) => void;
  updateComplete?: Promise<unknown>;
  shadowRoot: ShadowRoot | null;
};

function getElementClass(): CustomElementConstructor & {
  getStubConfig?: () => unknown;
} {
  const cls = customElements.get("decluttering-selector");
  if (!cls) {
    throw new Error("decluttering-selector is not registered on customElements");
  }
  return cls as CustomElementConstructor & { getStubConfig?: () => unknown };
}

function createElement(): SelectorElement {
  return document.createElement("decluttering-selector") as SelectorElement;
}

function typeForName(name: string): string {
  return `decluttering-card-${safeTagName(name)}`;
}

function makeTemplates(prefix: string, count: number): DeclutteringTemplates {
  const templates: DeclutteringTemplates = {};
  for (let i = 0; i < count; i += 1) {
    templates[`${prefix}-template-${i}`] = {
      card: { type: "x", entity: `[[entity${i}]]` },
      default: { [`entity${i}`]: `light.${prefix}_${i}` },
    };
  }
  return templates;
}

function makeHass(templates: DeclutteringTemplates, overrides: Record<string, unknown> = {}) {
  return {
    lovelace: {
      config: {
        decluttering_templates: templates,
      },
    },
    connection: {
      subscribeEvents: vi.fn().mockResolvedValue(() => {}),
    },
    callWS: vi.fn(),
    ...overrides,
  };
}

async function flush(el: { updateComplete?: Promise<unknown> }): Promise<void> {
  if (el.updateComplete) {
    await el.updateComplete;
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (el.updateComplete) {
    await el.updateComplete;
  }
}

beforeEach(() => {
  window.customCards = [];
});

afterEach(() => {
  window.history.pushState({}, "", "/");
});

describe("decluttering-selector registration", () => {
  it("registers a custom element under the decluttering-selector tag", () => {
    expect(customElements.get("decluttering-selector")).toBeDefined();
  });
});

describe("getStubConfig", () => {
  it("returns the custom:decluttering-selector stub config", async () => {
    const cls = getElementClass();
    expect(typeof cls.getStubConfig).toBe("function");
    const stub = await cls.getStubConfig!();
    expect(stub).toEqual({ type: "custom:decluttering-selector" });
  });
});

describe("setConfig", () => {
  it("does not throw when called with an empty object", () => {
    const el = createElement();
    expect(() => el.setConfig!({})).not.toThrow();
  });

  it("does not throw when called with undefined", () => {
    const el = createElement();
    expect(() => el.setConfig!(undefined)).not.toThrow();
  });

  it("accepts an optional title field without throwing", () => {
    const el = createElement();
    expect(() => el.setConfig!({ title: "My Templates" })).not.toThrow();
  });

  it("accepts an optional show_info field without throwing", () => {
    const el = createElement();
    expect(() => el.setConfig!({ show_info: true })).not.toThrow();
  });

  it("accepts an optional dedicated_picker field without throwing", () => {
    const el = createElement();
    expect(() => el.setConfig!({ dedicated_picker: true })).not.toThrow();
  });
});

describe("registration from hass.lovelace.config", () => {
  it("registers every template found under decluttering_templates into window.customCards", async () => {
    const templates = makeTemplates("lovelace-basic", 2);
    const el = createElement();
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    const expectedTypes = Object.keys(templates).map(typeForName);
    for (const type of expectedTypes) {
      expect(window.customCards!.some((c) => c.type === type)).toBe(true);
    }
    // Default mode (dedicated_picker false/absent): only the 2 per-template
    // entries are registered; the single wrapper "Choose a Template" entry is
    // NOT registered in this mode.
    expect(window.customCards).toHaveLength(2);
    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(false);

    document.body.removeChild(el);
  });
});

describe("registration fallback via hass.callWS", () => {
  it("calls hass.callWS with the current dashboard url_path when hass.lovelace is absent and registers the resolved templates", async () => {
    window.history.pushState({}, "", "/my-dashboard/0");
    const templates = makeTemplates("ws-fallback", 2);
    const callWS = vi.fn().mockResolvedValue({ decluttering_templates: templates });
    const hass = {
      callWS,
      panels: { "my-dashboard": { component_name: "lovelace" } },
      connection: { subscribeEvents: vi.fn().mockResolvedValue(() => {}) },
    };

    const el = createElement();
    document.body.appendChild(el);

    el.hass = hass;
    await flush(el);

    expect(callWS).toHaveBeenCalledWith({ type: "lovelace/config", url_path: "my-dashboard" });

    const expectedTypes = Object.keys(templates).map(typeForName);
    for (const type of expectedTypes) {
      expect(window.customCards!.some((c) => c.type === type)).toBe(true);
    }
    // Default mode: 2 per-template entries only, no wrapper picker entry.
    expect(window.customCards).toHaveLength(2);

    document.body.removeChild(el);
  });

  it('retries without url_path when the resolved "lovelace" dashboard is not found (pre-migration instances)', async () => {
    window.history.pushState({}, "", "/lovelace/0");
    const templates = makeTemplates("legacy-default", 1);
    const callWS = vi
      .fn()
      .mockRejectedValueOnce({ code: "config_not_found" })
      .mockResolvedValueOnce({ decluttering_templates: templates });
    const hass = {
      callWS,
      panels: { lovelace: { component_name: "lovelace" } },
      connection: { subscribeEvents: vi.fn().mockResolvedValue(() => {}) },
    };

    const el = createElement();
    document.body.appendChild(el);

    el.hass = hass;
    await flush(el);

    expect(callWS).toHaveBeenNthCalledWith(1, { type: "lovelace/config", url_path: "lovelace" });
    expect(callWS).toHaveBeenNthCalledWith(2, { type: "lovelace/config" });
    // Default mode: 1 per-template entry only, no wrapper picker entry.
    expect(window.customCards).toHaveLength(1);

    document.body.removeChild(el);
  });

  it("does not retry (and logs, leaving the card empty) when a non-default dashboard is not found", async () => {
    window.history.pushState({}, "", "/some-other-dashboard/0");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const callWS = vi.fn().mockRejectedValue({ code: "config_not_found" });
    const hass = {
      callWS,
      panels: { "some-other-dashboard": { component_name: "lovelace" } },
      connection: { subscribeEvents: vi.fn().mockResolvedValue(() => {}) },
    };

    const el = createElement();
    document.body.appendChild(el);

    el.hass = hass;
    await flush(el);

    expect(callWS).toHaveBeenCalledTimes(1);
    // _resolveTemplates() throws before _register()'s try block ever reaches
    // registerAll()/registerTemplatePickerCard(), so nothing gets registered,
    // including the picker card.
    expect(window.customCards).toHaveLength(0);
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
    document.body.removeChild(el);
  });
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
});

describe("registration when hass.panels has not hydrated yet", () => {
  it("still resolves and registers templates via the first path segment when hass.panels is absent", async () => {
    window.history.pushState({}, "", "/my-dashboard/0");
    const templates = makeTemplates("no-panels-yet", 1);
    const callWS = vi.fn().mockResolvedValue({ decluttering_templates: templates });
    const hass = {
      callWS,
      connection: { subscribeEvents: vi.fn().mockResolvedValue(() => {}) },
    };

    const el = createElement();
    document.body.appendChild(el);

    el.hass = hass;
    await flush(el);

    expect(callWS).toHaveBeenCalledWith({ type: "lovelace/config", url_path: "my-dashboard" });
    // Default mode: 1 per-template entry only, no wrapper picker entry.
    expect(window.customCards).toHaveLength(1);

    document.body.removeChild(el);
  });
});

describe("render", () => {
  it("does not throw and produces shadow DOM content when hass is entirely unset (show_info: true)", async () => {
    const el = createElement();
    el.setConfig!({ show_info: true });
    expect(() => document.body.appendChild(el)).not.toThrow();
    await flush(el);

    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.childNodes.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it("does not throw when a template has neither card nor element (show_info: true)", async () => {
    const templates: DeclutteringTemplates = {
      "malformed-no-card-or-element": {} as DeclutteringTemplate,
    };
    const el = createElement();
    el.setConfig!({ show_info: true });
    document.body.appendChild(el);

    expect(() => {
      el.hass = makeHass(templates);
    }).not.toThrow();
    await flush(el);

    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.childNodes.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it("does not throw when default is an unexpected type like a string (show_info: true)", async () => {
    const templates: DeclutteringTemplates = {
      "malformed-string-default": {
        card: { type: "x" },
        default: "not-an-object" as unknown as DeclutteringTemplate["default"],
      },
    };
    const el = createElement();
    el.setConfig!({ show_info: true });
    document.body.appendChild(el);

    expect(() => {
      el.hass = makeHass(templates);
    }).not.toThrow();
    await flush(el);

    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.childNodes.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it("renders no visible status content by default (show_info omitted)", async () => {
    const templates = makeTemplates("hidden-by-default", 2);
    const el = createElement();
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.textContent?.trim()).toBe("");

    document.body.removeChild(el);
  });

  it("renders no visible status content when show_info is explicitly false", async () => {
    const templates = makeTemplates("show-info-false", 2);
    const el = createElement();
    el.setConfig!({ show_info: false });
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    expect(el.shadowRoot!.textContent?.trim()).toBe("");

    document.body.removeChild(el);
  });

  it("renders the status list, including template names, when show_info is true", async () => {
    const templates = makeTemplates("show-info-true", 2);
    const el = createElement();
    el.setConfig!({ show_info: true, title: "My Templates" });
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    const text = el.shadowRoot!.textContent ?? "";
    expect(text).toContain("My Templates");
    expect(text).toContain("2 templates registered into Add Card");
    for (const name of Object.keys(templates)) {
      expect(text).toContain(name);
    }

    document.body.removeChild(el);
  });
});

describe("unsubscribe on disconnect", () => {
  it("calls the unsubscribe function returned by connection.subscribeEvents when the element is removed from the DOM", async () => {
    const templates = makeTemplates("unsub", 1);
    const unsubscribe = vi.fn();
    const subscribeEvents = vi.fn().mockResolvedValue(unsubscribe);

    const el = createElement();
    document.body.appendChild(el);

    el.hass = makeHass(templates, { connection: { subscribeEvents } });
    await flush(el);
    await flush(el);

    expect(subscribeEvents).toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();

    document.body.removeChild(el);
    await flush(el);

    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe("idempotent re-registration", () => {
  it("does not duplicate window.customCards entries when hass is set twice with the same templates", async () => {
    const templates = makeTemplates("idempotent-set-twice", 3);
    const el = createElement();
    document.body.appendChild(el);

    const firstHass = makeHass(templates);
    el.hass = firstHass;
    await flush(el);

    const secondHass = makeHass(templates);
    el.hass = secondHass;
    await flush(el);

    // Default mode: 3 per-template entries, still exactly 3 (not duplicated)
    // even after _register() has run twice (idempotent).
    expect(window.customCards).toHaveLength(3);

    document.body.removeChild(el);
  });
});

describe("dedicated_picker mode", () => {
  it("registers only the single wrapper entry, not any per-template entries, when dedicated_picker is true", async () => {
    const templates = makeTemplates("dedicated-only", 3);
    const el = createElement();
    el.setConfig!({ dedicated_picker: true });
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    expect(window.customCards).toHaveLength(1);
    expect(window.customCards![0].type).toBe("decluttering-template-picker");

    const expectedTypes = Object.keys(templates).map(typeForName);
    for (const type of expectedTypes) {
      expect(window.customCards!.some((c) => c.type === type)).toBe(false);
    }

    document.body.removeChild(el);
  });

  it("still fully populates getRegisteredMetas() in dedicated_picker mode even though per-template picker entries are suppressed", async () => {
    const templates = makeTemplates("dedicated-metas", 3);
    const el = createElement();
    el.setConfig!({ dedicated_picker: true });
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    const registeredNames = getRegisteredMetas().map((m) => m.name);
    for (const name of Object.keys(templates)) {
      expect(registeredNames).toContain(name);
    }

    document.body.removeChild(el);
  });

  it("does not accumulate entries from both modes when switching from default to dedicated_picker mid-session", async () => {
    const templates = makeTemplates("mode-switch-to-dedicated", 2);
    const el = createElement();
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    expect(window.customCards).toHaveLength(2);
    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(false);

    el.setConfig!({ dedicated_picker: true });
    el.hass = makeHass(templates);
    await flush(el);

    expect(window.customCards).toHaveLength(1);
    expect(window.customCards![0].type).toBe("decluttering-template-picker");
    const expectedTypes = Object.keys(templates).map(typeForName);
    for (const type of expectedTypes) {
      expect(window.customCards!.some((c) => c.type === type)).toBe(false);
    }

    document.body.removeChild(el);
  });

  it("does not accumulate entries from both modes when switching from dedicated_picker back to default mid-session", async () => {
    const templates = makeTemplates("mode-switch-to-default", 2);
    const el = createElement();
    el.setConfig!({ dedicated_picker: true });
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    expect(window.customCards).toHaveLength(1);
    expect(window.customCards![0].type).toBe("decluttering-template-picker");

    el.setConfig!({ dedicated_picker: false });
    el.hass = makeHass(templates);
    await flush(el);

    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(false);
    const expectedTypes = Object.keys(templates).map(typeForName);
    for (const type of expectedTypes) {
      expect(window.customCards!.some((c) => c.type === type)).toBe(true);
    }
    expect(window.customCards).toHaveLength(2);

    document.body.removeChild(el);
  });
});
