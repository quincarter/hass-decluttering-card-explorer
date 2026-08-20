import { describe, it, expect, beforeAll } from "vitest";
import "../src/template-picker-editor";
import { registerTemplate, getRegisteredMetas } from "../src/register";
import type { TemplateMeta } from "../src/types";

interface FakeCardConfig {
  type: string;
  template?: string;
  variables?: unknown;
}

// Same fake shape tests/template-picker.test.ts uses, kept consistent so both
// suites exercise the identical "real decluttering-card" contract.
class FakeDeclutteringCard extends HTMLElement {
  public hass?: unknown;
  public lastConfig?: FakeCardConfig;
  public setConfigCallCount = 0;

  setConfig(config: FakeCardConfig): void {
    this.lastConfig = config;
    this.setConfigCallCount += 1;
  }
}

type EditorElement = HTMLElement & {
  hass?: unknown;
  setConfig?: (config: unknown) => void;
  updateComplete?: Promise<unknown>;
  shadowRoot: ShadowRoot | null;
};

function createElement(): EditorElement {
  return document.createElement("decluttering-template-picker-editor") as EditorElement;
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

function makeMeta(safeName: string, overrides: Partial<TemplateMeta> = {}): TemplateMeta {
  const name = overrides.name ?? `Template ${safeName}`;
  return {
    name,
    safeName,
    variableCount: overrides.variableCount ?? 2,
    requiredVariables: overrides.requiredVariables ?? [],
    stubConfig: overrides.stubConfig ?? {
      type: "custom:decluttering-card",
      template: name,
      variables: [{ entity: `light.${safeName}` }],
    },
  };
}

function getFilterInput(el: EditorElement): HTMLInputElement {
  const input = el.shadowRoot!.querySelector('[data-testid="template-filter"]');
  if (!input) throw new Error("template-filter input not found in shadow DOM");
  return input as HTMLInputElement;
}

function setFilter(el: EditorElement, value: string): HTMLInputElement {
  const input = getFilterInput(el);
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return input;
}

function getItems(el: EditorElement): HTMLElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll('[data-testid="template-item"]'));
}

function getItem(el: EditorElement, templateName: string): HTMLElement {
  const item = el.shadowRoot!.querySelector(`[data-template-name="${templateName}"]`);
  if (!item) throw new Error(`template item for "${templateName}" not found`);
  return item as HTMLElement;
}

function clickItem(el: EditorElement, templateName: string): void {
  getItem(el, templateName).dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("decluttering-template-picker-editor registration", () => {
  it("registers a custom element under the decluttering-template-picker-editor tag", () => {
    expect(customElements.get("decluttering-template-picker-editor")).toBeDefined();
  });
});

// This must run before any registerTemplate() call below populates the shared
// register.ts module state, since that state persists for the rest of this file.
describe("render with no templates registered", () => {
  it("shows an empty-state message when getRegisteredMetas() returns nothing", async () => {
    expect(getRegisteredMetas()).toEqual([]);

    const el = createElement();
    document.body.appendChild(el);
    await flush(el);

    const text = el.shadowRoot!.textContent ?? "";
    expect(text).toContain("No templates found");
    expect(text).toContain("Decluttering Selector card is on this dashboard");
    expect(getItems(el)).toHaveLength(0);

    document.body.removeChild(el);
  });
});

describe("setConfig", () => {
  it("stores the config without throwing", () => {
    const el = createElement();
    expect(() =>
      el.setConfig!({ type: "custom:decluttering-template-picker", template: "Foo" }),
    ).not.toThrow();
  });

  it("does not throw when called with a bare type-only config", () => {
    const el = createElement();
    expect(() => el.setConfig!({ type: "custom:decluttering-template-picker" })).not.toThrow();
  });
});

describe("template registration setup", () => {
  const kitchen = makeMeta("editor-kitchen", {
    name: "Kitchen Lights",
    stubConfig: {
      type: "custom:decluttering-card",
      template: "Kitchen Lights",
      variables: [{ entity: "light.kitchen" }],
    },
  });
  const living = makeMeta("editor-living", {
    name: "Living Room Motion",
    stubConfig: {
      type: "custom:decluttering-card",
      template: "Living Room Motion",
      variables: [{ entity: "binary_sensor.living_room_motion" }],
    },
  });
  const bedroom = makeMeta("editor-bedroom", {
    name: "Bedroom Sensor",
    stubConfig: {
      type: "custom:decluttering-card",
      template: "Bedroom Sensor",
      variables: [{ entity: "binary_sensor.bedroom" }],
    },
  });

  beforeAll(() => {
    registerTemplate(kitchen);
    registerTemplate(living);
    registerTemplate(bedroom);
  });

  describe("search filtering", () => {
    it("shows all registered templates when the filter is empty", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      const names = getItems(el).map((item) => item.dataset.templateName);
      expect(names).toHaveLength(3);
      expect(names).toEqual(expect.arrayContaining([kitchen.name, living.name, bedroom.name]));

      document.body.removeChild(el);
    });

    it("narrows visible templates to those whose name contains the typed text", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      setFilter(el, "Kitchen");
      await flush(el);

      const names = getItems(el).map((item) => item.dataset.templateName);
      expect(names).toEqual([kitchen.name]);

      document.body.removeChild(el);
    });

    it("matches case-insensitively", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      setFilter(el, "KITCHEN");
      await flush(el);

      const names = getItems(el).map((item) => item.dataset.templateName);
      expect(names).toEqual([kitchen.name]);

      document.body.removeChild(el);
    });

    it("restores every template when the filter is cleared back to empty", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      setFilter(el, "Kitchen");
      await flush(el);
      expect(getItems(el)).toHaveLength(1);

      setFilter(el, "");
      await flush(el);
      expect(getItems(el)).toHaveLength(3);

      document.body.removeChild(el);
    });

    it("shows a no-matches state distinct from the no-templates-registered-at-all state when the filter matches nothing", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      setFilter(el, "zzz-nomatch-zzz");
      await flush(el);

      expect(getItems(el)).toHaveLength(0);
      const text = el.shadowRoot!.textContent ?? "";
      expect(el.shadowRoot!.querySelector('[data-testid="no-matches"]')).toBeTruthy();
      expect(text).not.toContain("Decluttering Selector card is on this dashboard");

      document.body.removeChild(el);
    });
  });

  // These fallback-row assertions must run before decluttering-card is ever
  // defined below — real custom elements can't be un-defined once registered,
  // so the "not installed" scenario can only be exercised earlier in this file.
  describe("without decluttering-card installed", () => {
    it("does not throw when rendering", async () => {
      expect(customElements.get("decluttering-card")).toBeUndefined();
      const el = createElement();
      expect(() => document.body.appendChild(el)).not.toThrow();
      await flush(el);
      expect(el.shadowRoot).toBeTruthy();
      document.body.removeChild(el);
    });

    it("renders a name-only row for each visible template instead of a preview", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      for (const meta of [kitchen, living, bedroom]) {
        const item = getItem(el, meta.name);
        expect(item.querySelector("decluttering-card")).toBeNull();
        expect(item.textContent ?? "").toContain(meta.name);
      }

      document.body.removeChild(el);
    });

    it("fires a config-changed event with the exact expected detail.config when a fallback row is clicked", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      let received: CustomEvent<{ config: unknown }> | undefined;
      el.addEventListener("config-changed", ((event: Event) => {
        received = event as CustomEvent<{ config: unknown }>;
      }) as EventListener);

      clickItem(el, bedroom.name);
      await flush(el);

      expect(received).toBeTruthy();
      expect(received!.detail.config).toEqual({
        type: "custom:decluttering-template-picker",
        template: bedroom.name,
        variables: bedroom.stubConfig.variables,
      });
      expect(received!.bubbles).toBe(true);
      expect(received!.composed).toBe(true);

      document.body.removeChild(el);
    });

    it("marks the item matching _config.template with the selected class", async () => {
      const el = createElement();
      el.setConfig!({ type: "custom:decluttering-template-picker", template: kitchen.name });
      document.body.appendChild(el);
      await flush(el);

      expect(getItem(el, kitchen.name).classList.contains("selected")).toBe(true);
      expect(getItem(el, living.name).classList.contains("selected")).toBe(false);
      expect(getItem(el, bedroom.name).classList.contains("selected")).toBe(false);

      document.body.removeChild(el);
    });

    it("does not mark any item selected when _config.template matches no visible template", async () => {
      const el = createElement();
      el.setConfig!({
        type: "custom:decluttering-template-picker",
        template: "Nonexistent Template",
      });
      document.body.appendChild(el);
      await flush(el);

      for (const meta of [kitchen, living, bedroom]) {
        expect(getItem(el, meta.name).classList.contains("selected")).toBe(false);
      }

      document.body.removeChild(el);
    });
  });

  describe("with decluttering-card installed", () => {
    // Registering the fake element must happen in a beforeAll hook rather than
    // directly in this describe body: Vitest collects the whole file (running
    // every describe callback synchronously) before running any test, so a
    // define() call made directly here would run before the earlier "not
    // installed" tests ever execute, defeating their premise.
    beforeAll(() => {
      if (!customElements.get("decluttering-card")) {
        customElements.define("decluttering-card", FakeDeclutteringCard);
      }
    });

    it("creates a decluttering-card preview child for each visible template", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      for (const meta of [kitchen, living, bedroom]) {
        const child = getItem(el, meta.name).querySelector(
          "decluttering-card",
        ) as FakeDeclutteringCard | null;
        expect(child).toBeTruthy();
      }

      document.body.removeChild(el);
    });

    it("calls setConfig on each preview child with that template's exact stubConfig", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      for (const meta of [kitchen, living, bedroom]) {
        const child = getItem(el, meta.name).querySelector(
          "decluttering-card",
        ) as FakeDeclutteringCard | null;
        expect(child?.lastConfig).toEqual(meta.stubConfig);
      }

      document.body.removeChild(el);
    });

    it("propagates hass onto every visible preview child when the editor's hass is set", async () => {
      const el = createElement();
      document.body.appendChild(el);

      const hass = { states: {}, language: "en" };
      el.hass = hass;
      await flush(el);

      for (const meta of [kitchen, living, bedroom]) {
        const child = getItem(el, meta.name).querySelector(
          "decluttering-card",
        ) as FakeDeclutteringCard | null;
        expect(child?.hass).toBe(hass);
      }

      document.body.removeChild(el);
    });

    it("reuses the same preview child instance and does not call setConfig again on an unrelated hass update", async () => {
      const el = createElement();
      document.body.appendChild(el);
      el.hass = { states: {}, language: "en" };
      await flush(el);

      const firstChild = getItem(el, kitchen.name).querySelector(
        "decluttering-card",
      ) as FakeDeclutteringCard | null;
      expect(firstChild?.setConfigCallCount).toBe(1);

      el.hass = { states: {}, language: "es" };
      await flush(el);
      el.hass = { states: {}, language: "fr" };
      await flush(el);

      const secondChild = getItem(el, kitchen.name).querySelector(
        "decluttering-card",
      ) as FakeDeclutteringCard | null;
      expect(secondChild).toBe(firstChild);
      expect(secondChild?.setConfigCallCount).toBe(1);
      expect(secondChild?.hass).toEqual({ states: {}, language: "fr" });

      document.body.removeChild(el);
    });

    it("does not call setConfig again on a preview element that remains visible across a filter change", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      setFilter(el, "kit");
      await flush(el);
      const firstChild = getItem(el, kitchen.name).querySelector(
        "decluttering-card",
      ) as FakeDeclutteringCard | null;
      expect(firstChild?.setConfigCallCount).toBe(1);

      setFilter(el, "kitchen");
      await flush(el);
      const secondChild = getItem(el, kitchen.name).querySelector(
        "decluttering-card",
      ) as FakeDeclutteringCard | null;

      expect(secondChild).toBe(firstChild);
      expect(secondChild?.setConfigCallCount).toBe(1);

      document.body.removeChild(el);
    });

    it("configures a preview for a template that was filtered out and then filtered back into view", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      setFilter(el, "living");
      await flush(el);
      expect(getItems(el).map((i) => i.dataset.templateName)).toEqual([living.name]);

      setFilter(el, "bedroom");
      await flush(el);
      expect(getItems(el).map((i) => i.dataset.templateName)).toEqual([bedroom.name]);

      setFilter(el, "living");
      await flush(el);

      const child = getItem(el, living.name).querySelector(
        "decluttering-card",
      ) as FakeDeclutteringCard | null;
      expect(child).toBeTruthy();
      expect(child?.lastConfig).toEqual(living.stubConfig);
      expect(child?.setConfigCallCount).toBeGreaterThanOrEqual(1);

      document.body.removeChild(el);
    });

    it("fires a config-changed event with the exact expected detail.config when a preview item is clicked", async () => {
      const el = createElement();
      document.body.appendChild(el);
      await flush(el);

      let received: CustomEvent<{ config: unknown }> | undefined;
      el.addEventListener("config-changed", ((event: Event) => {
        received = event as CustomEvent<{ config: unknown }>;
      }) as EventListener);

      clickItem(el, living.name);
      await flush(el);

      expect(received).toBeTruthy();
      expect(received!.detail.config).toEqual({
        type: "custom:decluttering-template-picker",
        template: living.name,
        variables: living.stubConfig.variables,
      });
      expect(received!.bubbles).toBe(true);
      expect(received!.composed).toBe(true);

      document.body.removeChild(el);
    });

    it("marks the item matching _config.template with the selected class when previews are rendered", async () => {
      const el = createElement();
      el.setConfig!({ type: "custom:decluttering-template-picker", template: bedroom.name });
      document.body.appendChild(el);
      await flush(el);

      expect(getItem(el, bedroom.name).classList.contains("selected")).toBe(true);
      expect(getItem(el, kitchen.name).classList.contains("selected")).toBe(false);

      document.body.removeChild(el);
    });
  });
});
