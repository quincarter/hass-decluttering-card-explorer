import { describe, it, expect, beforeAll } from "vitest";
import "../src/template-picker";

interface FakeCardConfig {
  type: string;
  template?: string;
  variables?: unknown;
}

class FakeDeclutteringCard extends HTMLElement {
  public hass?: unknown;
  public lastConfig?: FakeCardConfig;
  public setConfigCallCount = 0;

  setConfig(config: FakeCardConfig): void {
    this.lastConfig = config;
    this.setConfigCallCount += 1;
  }
}

type PickerElement = HTMLElement & {
  hass?: unknown;
  setConfig?: (config: unknown) => void;
  updateComplete?: Promise<unknown>;
  shadowRoot: ShadowRoot | null;
};

function getElementClass(): CustomElementConstructor & {
  getStubConfig?: () => Promise<unknown>;
  getConfigElement?: () => Promise<HTMLElement>;
} {
  const cls = customElements.get("decluttering-template-picker");
  if (!cls) {
    throw new Error("decluttering-template-picker is not registered on customElements");
  }
  return cls as CustomElementConstructor & {
    getStubConfig?: () => Promise<unknown>;
    getConfigElement?: () => Promise<HTMLElement>;
  };
}

function createElement(): PickerElement {
  return document.createElement("decluttering-template-picker") as PickerElement;
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

describe("decluttering-template-picker registration", () => {
  it("registers a custom element under the decluttering-template-picker tag", () => {
    expect(customElements.get("decluttering-template-picker")).toBeDefined();
  });
});

describe("getStubConfig", () => {
  it("resolves to the bare custom:decluttering-template-picker stub config", async () => {
    const cls = getElementClass();
    expect(typeof cls.getStubConfig).toBe("function");
    const stub = await cls.getStubConfig!();
    expect(stub).toEqual({ type: "custom:decluttering-template-picker" });
  });
});

describe("setConfig", () => {
  it("accepts a config with only type set without throwing", () => {
    const el = createElement();
    expect(() => el.setConfig!({ type: "custom:decluttering-template-picker" })).not.toThrow();
  });

  it("accepts a config with a template set without throwing", () => {
    const el = createElement();
    expect(() =>
      el.setConfig!({ type: "custom:decluttering-template-picker", template: "My Template" }),
    ).not.toThrow();
  });

  it("accepts a config with template and variables set without throwing", () => {
    const el = createElement();
    expect(() =>
      el.setConfig!({
        type: "custom:decluttering-template-picker",
        template: "My Template",
        variables: [{ entity: "light.kitchen" }],
      }),
    ).not.toThrow();
  });
});

// These two "render never throws" cases must run before decluttering-card is
// ever defined below — custom elements can't be un-defined once registered, so
// the "not installed" scenario can only be exercised earlier in this file.
describe("render when no template is selected", () => {
  it("does not throw when connected to the DOM", async () => {
    const el = createElement();
    el.setConfig!({ type: "custom:decluttering-template-picker" });
    expect(() => document.body.appendChild(el)).not.toThrow();
    await flush(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });
});

describe("render when decluttering-card is not installed", () => {
  it("does not throw when connected to the DOM with a template selected", async () => {
    expect(customElements.get("decluttering-card")).toBeUndefined();
    const el = createElement();
    el.setConfig!({ type: "custom:decluttering-template-picker", template: "Missing Dep" });
    document.body.appendChild(el);
    await flush(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });
});

describe("getConfigElement", () => {
  it("resolves to an element whose tag is decluttering-template-picker-editor", async () => {
    const cls = getElementClass();
    expect(typeof cls.getConfigElement).toBe("function");
    const editorEl = await cls.getConfigElement!();
    expect(editorEl.tagName.toLowerCase()).toBe("decluttering-template-picker-editor");
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

  it("does not throw when rendering with a template selected", async () => {
    const el = createElement();
    el.setConfig!({
      type: "custom:decluttering-template-picker",
      template: "Kitchen Lights",
      variables: [{ entity: "light.kitchen" }],
    });
    expect(() => document.body.appendChild(el)).not.toThrow();
    await flush(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it("creates and appends a real decluttering-card child element in the shadow DOM", async () => {
    const el = createElement();
    el.setConfig!({
      type: "custom:decluttering-template-picker",
      template: "Kitchen Lights",
      variables: [{ entity: "light.kitchen" }],
    });
    document.body.appendChild(el);
    await flush(el);

    const child = el.shadowRoot!.querySelector("decluttering-card") as FakeDeclutteringCard | null;
    expect(child).toBeTruthy();

    document.body.removeChild(el);
  });

  it("calls setConfig on the child with the wrapped decluttering-card config", async () => {
    const el = createElement();
    el.setConfig!({
      type: "custom:decluttering-template-picker",
      template: "Kitchen Lights",
      variables: [{ entity: "light.kitchen" }],
    });
    document.body.appendChild(el);
    await flush(el);

    const child = el.shadowRoot!.querySelector("decluttering-card") as FakeDeclutteringCard | null;
    expect(child?.lastConfig).toEqual({
      type: "custom:decluttering-card",
      template: "Kitchen Lights",
      variables: [{ entity: "light.kitchen" }],
    });

    document.body.removeChild(el);
  });

  it("propagates hass onto the child when the wrapper's hass is set", async () => {
    const el = createElement();
    el.setConfig!({ type: "custom:decluttering-template-picker", template: "Kitchen Lights" });
    document.body.appendChild(el);

    const hass = { states: {}, language: "en" };
    el.hass = hass;
    await flush(el);

    const child = el.shadowRoot!.querySelector("decluttering-card") as FakeDeclutteringCard | null;
    expect(child?.hass).toBe(hass);

    document.body.removeChild(el);
  });

  it("reuses the same child element instance across multiple re-renders", async () => {
    const el = createElement();
    el.setConfig!({ type: "custom:decluttering-template-picker", template: "Kitchen Lights" });
    document.body.appendChild(el);

    el.hass = { states: {}, language: "en" };
    await flush(el);
    const firstChild = el.shadowRoot!.querySelector("decluttering-card");
    expect(firstChild).toBeTruthy();

    el.hass = { states: {}, language: "en" };
    await flush(el);
    const secondChild = el.shadowRoot!.querySelector("decluttering-card");

    expect(secondChild).toBe(firstChild);

    document.body.removeChild(el);
  });

  it("does not re-run setConfig on the child when hass changes but template/variables stay the same", async () => {
    const el = createElement();
    el.setConfig!({
      type: "custom:decluttering-template-picker",
      template: "Kitchen Lights",
      variables: [{ entity: "light.kitchen" }],
    });
    document.body.appendChild(el);

    el.hass = { states: {}, language: "en" };
    await flush(el);
    const child = el.shadowRoot!.querySelector("decluttering-card") as FakeDeclutteringCard | null;
    expect(child?.setConfigCallCount).toBe(1);

    el.hass = { states: {}, language: "es" };
    await flush(el);
    el.hass = { states: {}, language: "fr" };
    await flush(el);

    expect(child?.setConfigCallCount).toBe(1);
    expect(child?.hass).toEqual({ states: {}, language: "fr" });

    document.body.removeChild(el);
  });

  it("re-runs setConfig on the child when the template changes", async () => {
    const el = createElement();
    el.setConfig!({ type: "custom:decluttering-template-picker", template: "Kitchen Lights" });
    document.body.appendChild(el);
    await flush(el);

    const child = el.shadowRoot!.querySelector("decluttering-card") as FakeDeclutteringCard | null;
    expect(child?.setConfigCallCount).toBe(1);

    el.setConfig!({ type: "custom:decluttering-template-picker", template: "Living Room" });
    await flush(el);

    expect(child?.setConfigCallCount).toBe(2);
    expect(child?.lastConfig).toEqual({
      type: "custom:decluttering-card",
      template: "Living Room",
      variables: undefined,
    });

    document.body.removeChild(el);
  });
});
