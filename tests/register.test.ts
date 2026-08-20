import { describe, it, expect, beforeEach } from "vitest";
import {
  makePreviewElement,
  registerTemplate,
  registerAll,
  getRegisteredMetas,
  registerTemplatePickerCard,
} from "../src/register";
import type { TemplateMeta } from "../src/types";

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

// HA's custom-card resolution does `customElements.get(stripCustomPrefix(type))`
// directly — no `hui-card-`/`hui-` prefix (that convention is only for HA's own
// built-in card types, a different code path). So the registered custom-element tag
// must be exactly the same string as the window.customCards `type` field.
function typeFor(meta: TemplateMeta): string {
  return `decluttering-card-${meta.safeName}`;
}

function tagFor(meta: TemplateMeta): string {
  return typeFor(meta);
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
      variables: [],
    },
  };
}

beforeEach(() => {
  window.customCards = [];
});

describe("makePreviewElement", () => {
  it("returns a class whose static getStubConfig resolves to meta.stubConfig", async () => {
    const meta = makeMeta("preview-stub");
    const tag = "decluttering-card-preview-stub";
    const Cls = makePreviewElement(tag, meta) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(meta.stubConfig);
  });

  it("does not throw when render is invoked directly", () => {
    const meta = makeMeta("preview-render-direct");
    const tag = "decluttering-card-preview-render-direct";
    const Cls = makePreviewElement(tag, meta);
    customElements.define(tag, Cls);
    const el = document.createElement(tag) as unknown as { render: () => unknown };
    expect(() => el.render()).not.toThrow();
  });

  it("does not throw when connected to the DOM and updated", async () => {
    const meta = makeMeta("preview-connect");
    const tag = "decluttering-card-preview-connect";
    customElements.define(tag, makePreviewElement(tag, meta));
    const el = document.createElement(tag) as unknown as HTMLElement & {
      updateComplete?: Promise<unknown>;
    };
    expect(() => document.body.appendChild(el)).not.toThrow();
    if (el.updateComplete) {
      await expect(el.updateComplete).resolves.toBeTruthy();
    }
    document.body.removeChild(el);
  });
});

describe("registerTemplate", () => {
  it("defines the custom element tag when it does not already exist", () => {
    const meta = makeMeta("reg-define");
    registerTemplate(meta);
    expect(customElements.get(tagFor(meta))).toBeDefined();
  });

  it("defines the custom element at exactly the type string HA would resolve, independent of this test file's own tag formula", () => {
    // Deliberately does not use tagFor()/typeFor() — HA resolves a custom card type
    // as customElements.get(stripCustomPrefix(entry.type)) directly (no hui-card-
    // prefix), so this reads entry.type straight from window.customCards and checks
    // customElements against it, matching HA's real behavior rather than whatever
    // formula this test file happens to compute.
    const meta = makeMeta("reg-real-resolution");
    registerTemplate(meta);
    const entry = window.customCards!.find((c) => c.name === `Decluttering: ${meta.name}`);
    expect(entry).toBeDefined();
    expect(customElements.get(entry!.type)).toBeDefined();
  });

  it("getStubConfig on the registered class returns exactly meta.stubConfig", async () => {
    const meta = makeMeta("reg-stub", {
      stubConfig: {
        type: "custom:decluttering-card",
        template: "Reg Stub",
        variables: [{ a: 1 }],
      },
    });
    registerTemplate(meta);
    const Cls = customElements.get(tagFor(meta)) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(meta.stubConfig);
  });

  it("adds a matching entry to window.customCards", () => {
    const meta = makeMeta("reg-cards", { name: "My Cool Template" });
    registerTemplate(meta);
    const entry = window.customCards!.find((c) => c.type === typeFor(meta));
    expect(entry).toBeDefined();
    expect(entry?.name).toBe("Decluttering: My Cool Template");
    expect(entry?.preview).toBe(true);
  });

  it("creates window.customCards when it does not already exist", () => {
    delete (window as { customCards?: CustomCardEntry[] }).customCards;
    const meta = makeMeta("reg-create-array");
    registerTemplate(meta);
    expect(Array.isArray(window.customCards)).toBe(true);
    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(true);
  });

  it("does not throw and does not duplicate the customCards entry on repeated registration", () => {
    const meta = makeMeta("reg-idempotent");
    registerTemplate(meta);
    expect(() => registerTemplate(meta)).not.toThrow();
    const matches = window.customCards!.filter((c) => c.type === typeFor(meta));
    expect(matches).toHaveLength(1);
  });

  it("updates the customCards entry in place when re-registering the same template with changed data", () => {
    // Same `name` (the template's identity) across both calls — this is an edit, not
    // a rename-into-collision, so it must update in place rather than being skipped
    // by the collision guard (which keys off `name` differing for the same tag).
    const meta = makeMeta("reg-update", { name: "Same Name", variableCount: 1 });
    registerTemplate(meta);
    const updated = { ...meta, variableCount: 5 };
    registerTemplate(updated);
    const matches = window.customCards!.filter((c) => c.type === typeFor(meta));
    expect(matches).toHaveLength(1);
    expect(matches[0].description).toContain("5");
  });

  it("does not redefine an existing custom element tag on repeated registration", () => {
    const meta = makeMeta("reg-no-redefine");
    registerTemplate(meta);
    const first = customElements.get(tagFor(meta));
    registerTemplate(meta);
    const second = customElements.get(tagFor(meta));
    expect(second).toBe(first);
  });
});

describe("registerTemplate re-registration with changed data", () => {
  it("updates getStubConfig on the resolved class after re-registering the same template with a different stubConfig", async () => {
    const metaV1 = makeMeta("reg-stale-stub", {
      name: "Stale Stub Template",
      stubConfig: {
        type: "custom:decluttering-card",
        template: "Stale Stub Template",
        variables: [{ a: 1 }],
      },
    });
    registerTemplate(metaV1);

    const metaV2: TemplateMeta = {
      ...metaV1,
      stubConfig: {
        type: "custom:decluttering-card",
        template: "Stale Stub Template",
        variables: [{ a: 2 }, { b: "new" }],
      },
    };
    registerTemplate(metaV2);

    const Cls = customElements.get(tagFor(metaV1)) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(metaV2.stubConfig);
  });
});

describe("registerTemplate tag collisions", () => {
  it("skips the second registration entirely when two different templates sanitize to the same safeName", async () => {
    const collidingSafeName = "collision-x";
    const metaFirst = makeMeta(collidingSafeName, {
      name: "First Collider",
      stubConfig: {
        type: "custom:decluttering-card",
        template: "First Collider",
        variables: [{ a: 1 }],
      },
    });
    const metaSecond = makeMeta(collidingSafeName, {
      name: "Second Collider",
      stubConfig: {
        type: "custom:decluttering-card",
        template: "Second Collider",
        variables: [{ b: 2 }],
      },
    });

    registerTemplate(metaFirst);
    registerTemplate(metaSecond);

    const matches = window.customCards!.filter((c) => c.type === typeFor(metaFirst));
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("Decluttering: First Collider");

    const Cls = customElements.get(tagFor(metaFirst)) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(metaFirst.stubConfig);
  });
});

describe("registerAll", () => {
  it("registers each meta and returns the list of registered types", () => {
    const metas = [makeMeta("all-one"), makeMeta("all-two"), makeMeta("all-three")];
    const types = registerAll(metas);
    expect(types).toEqual(metas.map(typeFor));
    for (const meta of metas) {
      expect(customElements.get(tagFor(meta))).toBeDefined();
      expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(true);
    }
  });

  it("returns an empty list for an empty input array", () => {
    expect(registerAll([])).toEqual([]);
  });
});

describe("registerAll tag reconciliation across passes", () => {
  it("releases a colliding tag's ownership when the owning template is absent from a later registerAll pass", async () => {
    const ownerMeta = makeMeta("reconcile-x", {
      name: "Owner",
      stubConfig: {
        type: "custom:decluttering-card",
        template: "Owner",
        variables: [{ owner: 1 }],
      },
    });
    const loserMeta = makeMeta("reconcile-x", {
      name: "Loser",
      stubConfig: {
        type: "custom:decluttering-card",
        template: "Loser",
        variables: [{ loser: 2 }],
      },
    });

    registerAll([ownerMeta, loserMeta]);

    let matches = window.customCards!.filter((c) => c.type === typeFor(ownerMeta));
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("Decluttering: Owner");

    registerAll([loserMeta]);

    matches = window.customCards!.filter((c) => c.type === typeFor(loserMeta));
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe("Decluttering: Loser");

    const Cls = customElements.get(tagFor(loserMeta)) as unknown as {
      getStubConfig: () => Promise<unknown>;
    };
    const stub = await Cls.getStubConfig();
    expect(stub).toEqual(loserMeta.stubConfig);
  });
});

describe("getRegisteredMetas", () => {
  it("includes a meta registered via registerTemplate", () => {
    const meta = makeMeta("get-metas-single");
    registerTemplate(meta);
    expect(getRegisteredMetas()).toContain(meta);
  });

  it("includes every meta registered via a registerAll pass", () => {
    const metas = [makeMeta("get-metas-all-a"), makeMeta("get-metas-all-b")];
    registerAll(metas);
    const registered = getRegisteredMetas();
    for (const meta of metas) {
      expect(registered).toContain(meta);
    }
  });

  it("reflects tag reconciliation: a meta released by a later registerAll pass is no longer present", () => {
    const ownerMeta = makeMeta("get-metas-reconcile", { name: "Reconcile Owner" });
    const loserMeta = makeMeta("get-metas-reconcile", { name: "Reconcile Loser" });
    registerAll([ownerMeta, loserMeta]);
    expect(getRegisteredMetas()).toContain(ownerMeta);

    registerAll([loserMeta]);
    expect(getRegisteredMetas()).not.toContain(ownerMeta);
    expect(getRegisteredMetas()).toContain(loserMeta);
  });
});

describe("registerTemplatePickerCard", () => {
  // Contract: registerTemplatePickerCard(register: boolean) is now symmetric —
  // `true` idempotently adds the single wrapper entry, `false` idempotently
  // removes it. There is no default; callers must be explicit about which mode
  // is currently active so decluttering-selector.ts can toggle it on
  // `dedicated_picker` config changes without leaking a stale entry.
  it("pushes a single entry with the expected type and preview flag when passed true", () => {
    registerTemplatePickerCard(true);
    const matches = window.customCards!.filter((c) => c.type === "decluttering-template-picker");
    expect(matches).toHaveLength(1);
    expect(matches[0].preview).toBe(true);
  });

  it('registers a name starting with the sort-first "0" prefix so it lists ahead of other community cards alphabetically', () => {
    registerTemplatePickerCard(true);
    const entry = window.customCards!.find((c) => c.type === "decluttering-template-picker");
    expect(entry).toBeDefined();
    // Digit code points sort before both upper- and lower-case ASCII letters in
    // default string comparison, so a leading "0" guarantees this entry is
    // first in HA's alphabetically-sorted "Community cards" list regardless of
    // what other custom cards (mushroom, button-card, etc.) are installed.
    expect(entry!.name.startsWith("0")).toBe(true);
    expect(entry!.name < "Button Card").toBe(true);
    expect(entry!.name < "Core cards").toBe(true);
    expect(entry!.name < "a").toBe(true);
  });

  it("does not duplicate the entry when called with true more than once", () => {
    registerTemplatePickerCard(true);
    expect(() => registerTemplatePickerCard(true)).not.toThrow();
    registerTemplatePickerCard(true);
    const matches = window.customCards!.filter((c) => c.type === "decluttering-template-picker");
    expect(matches).toHaveLength(1);
  });

  it("creates window.customCards when it does not already exist and passed true", () => {
    delete (window as { customCards?: CustomCardEntry[] }).customCards;
    registerTemplatePickerCard(true);
    expect(Array.isArray(window.customCards)).toBe(true);
    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(true);
  });

  it("removes the entry when passed false after it was previously added", () => {
    registerTemplatePickerCard(true);
    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(true);
    registerTemplatePickerCard(false);
    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(false);
  });

  it("is a no-op and does not throw when passed false and the entry is not present", () => {
    expect(() => registerTemplatePickerCard(false)).not.toThrow();
    expect(window.customCards!.some((c) => c.type === "decluttering-template-picker")).toBe(false);
  });

  it("creates window.customCards when it does not already exist and passed false", () => {
    delete (window as { customCards?: CustomCardEntry[] }).customCards;
    expect(() => registerTemplatePickerCard(false)).not.toThrow();
    expect(Array.isArray(window.customCards)).toBe(true);
  });
});

describe("registerTemplate with registerCard: false", () => {
  it("still records the meta in getRegisteredMetas() when the per-template customCards entry is suppressed", () => {
    const meta = makeMeta("suppress-metas");
    registerTemplate(meta, { registerCard: false });
    expect(getRegisteredMetas()).toContain(meta);
  });

  it("does not push a window.customCards entry when registerCard is false", () => {
    const meta = makeMeta("suppress-no-entry");
    registerTemplate(meta, { registerCard: false });
    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(false);
  });

  it("still defines the custom element tag when registerCard is false", () => {
    const meta = makeMeta("suppress-still-defines");
    registerTemplate(meta, { registerCard: false });
    expect(customElements.get(tagFor(meta))).toBeDefined();
  });

  it("adds the entry once a later call passes registerCard: true for a previously-suppressed template", () => {
    const meta = makeMeta("suppress-then-register");
    registerTemplate(meta, { registerCard: false });
    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(false);
    registerTemplate(meta, { registerCard: true });
    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(true);
  });

  it("removes an existing entry when a later call passes registerCard: false for a previously-registered template", () => {
    const meta = makeMeta("register-then-suppress");
    registerTemplate(meta);
    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(true);
    registerTemplate(meta, { registerCard: false });
    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(false);
    expect(getRegisteredMetas()).toContain(meta);
  });
});

describe("registerAll with registerCards: false", () => {
  it("populates getRegisteredMetas() for every meta even though no per-template entries are pushed", () => {
    const metas = [makeMeta("suppress-all-a"), makeMeta("suppress-all-b")];
    registerAll(metas, { registerCards: false });
    const registered = getRegisteredMetas();
    for (const meta of metas) {
      expect(registered).toContain(meta);
      expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(false);
    }
  });

  it("removes previously-registered per-template entries when the same metas are re-registered with registerCards: false", () => {
    const metas = [makeMeta("mode-switch-a"), makeMeta("mode-switch-b")];
    registerAll(metas);
    for (const meta of metas) {
      expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(true);
    }

    registerAll(metas, { registerCards: false });
    for (const meta of metas) {
      expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(false);
      expect(getRegisteredMetas()).toContain(meta);
    }
  });

  it("adds entries back when metas are re-registered with registerCards: true after being suppressed", () => {
    const metas = [makeMeta("mode-switch-back-a")];
    registerAll(metas, { registerCards: false });
    expect(window.customCards!.some((c) => c.type === typeFor(metas[0]))).toBe(false);

    registerAll(metas);
    expect(window.customCards!.some((c) => c.type === typeFor(metas[0]))).toBe(true);
  });
});

describe("registerAll stale entry cleanup", () => {
  it("removes a template's window.customCards entry (not just its internal bookkeeping) when it is absent from a later registerAll pass", () => {
    const meta = makeMeta("stale-cleanup");
    registerAll([meta]);
    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(true);

    registerAll([]);

    expect(window.customCards!.some((c) => c.type === typeFor(meta))).toBe(false);
    expect(getRegisteredMetas()).not.toContain(meta);
  });

  it("removes a renamed template's old entry (a different safeName, not a tag collision) while keeping the new one", () => {
    const oldMeta = makeMeta("stale-rename-old", { name: "Old Name" });
    registerAll([oldMeta]);
    expect(window.customCards!.some((c) => c.type === typeFor(oldMeta))).toBe(true);

    const newMeta = makeMeta("stale-rename-new", { name: "New Name" });
    registerAll([newMeta]);

    expect(window.customCards!.some((c) => c.type === typeFor(oldMeta))).toBe(false);
    expect(window.customCards!.some((c) => c.type === typeFor(newMeta))).toBe(true);
    expect(getRegisteredMetas()).not.toContain(oldMeta);
  });
});
