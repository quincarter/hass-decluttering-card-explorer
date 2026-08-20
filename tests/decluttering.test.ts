import { describe, it, expect, vi } from "vitest";
import {
  safeTagName,
  extractTemplates,
  buildStubConfig,
  analyzeTemplates,
  getDeclutteringTemplates,
  resolveDashboardConfig,
  findDeclutteringSelectorConfig,
} from "../src/decluttering";
import type { DeclutteringTemplate, DeclutteringTemplates, TemplateMeta } from "../src/types";

describe("safeTagName", () => {
  it("lowercases and replaces illegal characters with a single hyphen", () => {
    expect(safeTagName("My_Template!")).toBe("my-template");
  });

  it("collapses repeated separators into a single hyphen", () => {
    expect(safeTagName("a__b")).toBe("a-b");
    expect(safeTagName("a---b")).toBe("a-b");
  });

  it("trims leading and trailing hyphens produced by illegal-character replacement", () => {
    expect(safeTagName("!!!leading")).toBe("leading");
    expect(safeTagName("trailing!!!")).toBe("trailing");
    expect(safeTagName("--Foo--")).toBe("foo");
  });

  it("prefixes with t- when the sanitized result starts with a digit", () => {
    expect(safeTagName("1foo")).toBe("t-1foo");
  });

  it("does not prefix when the sanitized name does not start with a digit", () => {
    expect(safeTagName("foo1")).toBe("foo1");
  });

  it("returns an empty string for empty input", () => {
    expect(safeTagName("")).toBe("");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(safeTagName("   ")).toBe("");
  });

  it("returns an empty string for input made entirely of illegal characters", () => {
    expect(safeTagName("!!!")).toBe("");
  });

  it("replaces unicode characters as illegal and trims the resulting hyphen", () => {
    expect(safeTagName("café")).toBe("caf");
  });

  it("leaves already-legal lowercase alphanumeric-and-hyphen names unchanged", () => {
    expect(safeTagName("already-legal-123")).toBe("already-legal-123");
  });
});

describe("extractTemplates", () => {
  it("returns the decluttering_templates map when present", () => {
    const templates: DeclutteringTemplates = { foo: { card: { type: "x" } } };
    expect(extractTemplates({ decluttering_templates: templates })).toBe(templates);
  });

  it("returns an empty object when decluttering_templates is absent", () => {
    expect(extractTemplates({})).toEqual({});
  });

  it("returns an empty object when decluttering_templates is explicitly an empty object", () => {
    expect(extractTemplates({ decluttering_templates: {} })).toEqual({});
  });
});

describe("buildStubConfig", () => {
  it("sets type to custom:decluttering-card and template to the given name", () => {
    const result = buildStubConfig("My Template", {});
    expect(result.type).toBe("custom:decluttering-card");
    expect(result.template).toBe("My Template");
  });

  it("returns an empty variables array when the template has no default", () => {
    const result = buildStubConfig("T", {});
    expect(result.variables).toEqual([]);
  });

  it("converts a flat-object default into an array of single-key objects", () => {
    const result = buildStubConfig("T", { default: { x: "foo", y: "bar" } });
    expect(result.variables).toEqual([{ x: "foo" }, { y: "bar" }]);
  });

  it("merges an array-of-objects default and expresses it as an array of single-key objects", () => {
    const result = buildStubConfig("T", { default: [{ a: 1 }, { b: 2 }] });
    expect(result.variables).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("lets later entries in an array-of-objects default override earlier ones for the same key", () => {
    const result = buildStubConfig("T", { default: [{ a: 1 }, { a: 2 }] });
    expect(result.variables).toEqual([{ a: 2 }]);
  });

  it("treats a string default as no defaults rather than spreading its characters", () => {
    const result = buildStubConfig("T", {
      default: "not-an-object" as unknown as DeclutteringTemplate["default"],
    });
    expect(result.variables).toEqual([]);
  });

  it("treats a number default as no defaults", () => {
    const result = buildStubConfig("T", {
      default: 42 as unknown as DeclutteringTemplate["default"],
    });
    expect(result.variables).toEqual([]);
  });

  it("treats a boolean default as no defaults", () => {
    const result = buildStubConfig("T", {
      default: true as unknown as DeclutteringTemplate["default"],
    });
    expect(result.variables).toEqual([]);
  });

  it("treats a null default as no defaults", () => {
    const result = buildStubConfig("T", {
      default: null as unknown as DeclutteringTemplate["default"],
    });
    expect(result.variables).toEqual([]);
  });
});

describe("analyzeTemplates", () => {
  it("returns an empty array for an empty templates map", () => {
    expect(analyzeTemplates({})).toEqual([]);
  });

  it("counts a placeholder referenced more than once as a single variable", () => {
    const templates: DeclutteringTemplates = {
      "My Template": {
        card: {
          type: "custom:mushroom-light-card",
          entity: "[[entity]]",
          name: "[[entity]] Light",
        },
        default: { entity: "light.kitchen" },
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.variableCount).toBe(1);
  });

  it("finds placeholders nested inside nested object values", () => {
    const templates: DeclutteringTemplates = {
      Nested: {
        card: {
          type: "x",
          nested: { deeper: { color: "[[color]]" } },
        },
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.variableCount).toBe(1);
    expect(meta.requiredVariables).toEqual(["color"]);
  });

  it("lists variables with no corresponding default key as required", () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: "[[entity]]", color: "[[color]]" },
        default: { entity: "light.x" },
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.requiredVariables).toEqual(["color"]);
  });

  it("marks all found variables as required when the template has no default", () => {
    const templates: DeclutteringTemplates = {
      T: { card: { entity: "[[entity]]", color: "[[color]]" } },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(["color", "entity"]);
  });

  it("derives safeName from the template key using the same rules as safeTagName", () => {
    const templates: DeclutteringTemplates = { "My_Template!": { card: {} } };
    const [meta] = analyzeTemplates(templates);
    expect(meta.safeName).toBe(safeTagName("My_Template!"));
  });

  it("includes a stubConfig equivalent to calling buildStubConfig directly", () => {
    const template: DeclutteringTemplate = {
      card: { entity: "[[entity]]" },
      default: { entity: "light.x" },
    };
    const templates: DeclutteringTemplates = { T: template };
    const [meta] = analyzeTemplates(templates);
    expect(meta.stubConfig).toEqual(buildStubConfig("T", template));
  });

  it("reads placeholders from element-mode templates when card is absent", () => {
    const templates: DeclutteringTemplates = {
      E: { element: { type: "icon", icon: "[[icon]]" } },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.variableCount).toBe(1);
    expect(meta.requiredVariables).toEqual(["icon"]);
  });

  it("produces one meta entry per template key, preserving the name field", () => {
    const templates: DeclutteringTemplates = {
      A: { card: {} },
      B: { card: {} },
    };
    const metas = analyzeTemplates(templates);
    expect(metas.map((m: TemplateMeta) => m.name).sort()).toEqual(["A", "B"]);
  });

  it("marks all placeholders required when default is a string, same as no default at all", () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: "[[entity]]", color: "[[color]]" },
        default: "nonsense" as unknown as DeclutteringTemplate["default"],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(["color", "entity"]);
  });

  it("marks all placeholders required when default is a number, same as no default at all", () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: "[[entity]]", color: "[[color]]" },
        default: 7 as unknown as DeclutteringTemplate["default"],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(["color", "entity"]);
  });

  it("marks all placeholders required when default is a boolean, same as no default at all", () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: "[[entity]]", color: "[[color]]" },
        default: false as unknown as DeclutteringTemplate["default"],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(["color", "entity"]);
  });

  it("marks all placeholders required when default is null, same as no default at all", () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: "[[entity]]", color: "[[color]]" },
        default: null as unknown as DeclutteringTemplate["default"],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(["color", "entity"]);
  });

  it("produces an empty variables array in stubConfig when default is a malformed string, matching buildStubConfig", () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: "[[entity]]" },
        default: "nonsense" as unknown as DeclutteringTemplate["default"],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.stubConfig.variables).toEqual([]);
  });
});

describe("getDeclutteringTemplates", () => {
  it("returns the decluttering_templates map from hass.lovelace.config, equivalent to extractTemplates", () => {
    const templates: DeclutteringTemplates = { foo: { card: { type: "x" } } };
    const config = { decluttering_templates: templates };
    const hass = { lovelace: { config } };
    expect(getDeclutteringTemplates(hass)).toEqual(extractTemplates(config));
  });

  it("returns an empty object when hass.lovelace.config is present but decluttering_templates is absent", () => {
    const hass = { lovelace: { config: {} } };
    expect(getDeclutteringTemplates(hass)).toEqual({});
  });

  it("returns an empty object when hass.lovelace.config has decluttering_templates explicitly empty", () => {
    const hass = { lovelace: { config: { decluttering_templates: {} } } };
    expect(getDeclutteringTemplates(hass)).toEqual({});
  });

  it("throws when hass.lovelace is undefined", () => {
    const hass = {};
    expect(() => getDeclutteringTemplates(hass)).toThrow();
  });

  it("throws when hass.lovelace is present but hass.lovelace.config is undefined", () => {
    const hass = { lovelace: {} };
    expect(() => getDeclutteringTemplates(hass)).toThrow();
  });

  it("throws LovelaceUnavailableError (not a generic TypeError) when hass itself is undefined", () => {
    expect(() => getDeclutteringTemplates(undefined)).toThrow();
    try {
      getDeclutteringTemplates(undefined);
    } catch (error) {
      expect((error as Error).name).toBe("LovelaceUnavailableError");
    }
  });

  it("throws LovelaceUnavailableError (not a generic TypeError) when hass itself is null", () => {
    expect(() => getDeclutteringTemplates(null)).toThrow();
    try {
      getDeclutteringTemplates(null);
    } catch (error) {
      expect((error as Error).name).toBe("LovelaceUnavailableError");
    }
  });

  it('throws an error identifiable as "unavailable" so a caller can distinguish it from other errors', () => {
    const hass = {};
    expect.assertions(3);
    try {
      getDeclutteringTemplates(hass);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("LovelaceUnavailableError");
      expect((error as Error).message.length).toBeGreaterThan(0);
    }
  });

  it("throws the same identifiable error type regardless of whether lovelace or lovelace.config is the missing piece", () => {
    const missingLovelace = {};
    const missingConfig = { lovelace: {} };

    let firstErrorName: string | undefined;
    let secondErrorName: string | undefined;

    try {
      getDeclutteringTemplates(missingLovelace);
    } catch (error) {
      firstErrorName = (error as Error).name;
    }

    try {
      getDeclutteringTemplates(missingConfig);
    } catch (error) {
      secondErrorName = (error as Error).name;
    }

    expect(firstErrorName).toBe("LovelaceUnavailableError");
    expect(secondErrorName).toBe("LovelaceUnavailableError");
  });
});

describe("resolveDashboardConfig", () => {
  it("returns hass.lovelace.config directly, including fields beyond decluttering_templates like views, when the primary path is available", async () => {
    const config = {
      decluttering_templates: { foo: { card: { type: "x" } } },
      views: [{ cards: [] }],
    };
    const hass = { lovelace: { config } };
    const result = await resolveDashboardConfig(hass, "lovelace");
    expect(result).toEqual(config);
  });

  it("returns the raw config object rather than a pre-extracted templates map on the primary path", async () => {
    const config = { decluttering_templates: { foo: { card: {} } }, views: [] };
    const hass = { lovelace: { config } };
    const result = await resolveDashboardConfig(hass, "lovelace");
    expect(result).toHaveProperty("views");
    expect(result).toHaveProperty("decluttering_templates");
  });

  it("falls back to hass.callWS with the given url_path when hass.lovelace is unavailable", async () => {
    const config = { decluttering_templates: { foo: { card: { type: "x" } } } };
    const callWS = vi.fn().mockResolvedValue(config);
    const hass = { callWS };
    const result = await resolveDashboardConfig(hass, "my-dashboard");
    expect(callWS).toHaveBeenCalledWith({ type: "lovelace/config", url_path: "my-dashboard" });
    expect(result).toEqual(config);
  });

  it('retries once with no url_path when urlPath is "lovelace" and the error code is config_not_found (pre-migration instances)', async () => {
    const legacyConfig = { decluttering_templates: { legacy: { card: { type: "x" } } } };
    const callWS = vi
      .fn()
      .mockRejectedValueOnce({ code: "config_not_found" })
      .mockResolvedValueOnce(legacyConfig);
    const hass = { callWS };
    const result = await resolveDashboardConfig(hass, "lovelace");
    expect(callWS).toHaveBeenNthCalledWith(1, { type: "lovelace/config", url_path: "lovelace" });
    expect(callWS).toHaveBeenNthCalledWith(2, { type: "lovelace/config" });
    expect(result).toEqual(legacyConfig);
  });

  it('warns on the console before retrying the pre-migration fallback, identifying the "lovelace" url_path case', async () => {
    const legacyConfig = { decluttering_templates: { legacy: { card: { type: "x" } } } };
    const callWS = vi
      .fn()
      .mockRejectedValueOnce({ code: "config_not_found" })
      .mockResolvedValueOnce(legacyConfig);
    const hass = { callWS };
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await resolveDashboardConfig(hass, "lovelace");
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleWarn.mock.calls[0][0]).toContain(
      'no dashboard registered at url_path "lovelace"',
    );
    consoleWarn.mockRestore();
  });

  it("does not retry and propagates the error when a non-lovelace url_path is not found", async () => {
    const callWS = vi.fn().mockRejectedValue({ code: "config_not_found" });
    const hass = { callWS };
    await expect(resolveDashboardConfig(hass, "some-other-dashboard")).rejects.toBeDefined();
    expect(callWS).toHaveBeenCalledTimes(1);
  });

  it("propagates errors from callWS that are not the pre-migration config_not_found case", async () => {
    const callWS = vi.fn().mockRejectedValue(new Error("boom"));
    const hass = { callWS };
    await expect(resolveDashboardConfig(hass, "lovelace")).rejects.toThrow("boom");
  });

  it("returns an empty object when hass.lovelace is unavailable and hass.callWS is not a function", async () => {
    const hass = {};
    const result = await resolveDashboardConfig(hass, "lovelace");
    expect(result).toEqual({});
  });

  it("returns an empty object when hass itself is undefined and no callWS is available", async () => {
    const result = await resolveDashboardConfig(undefined, undefined);
    expect(result).toEqual({});
  });
});

describe("findDeclutteringSelectorConfig", () => {
  it("finds a matching card at the top level of a view's cards array and returns its config minus type", () => {
    const config = {
      views: [
        {
          cards: [
            { type: "some-other-card" },
            { type: "custom:decluttering-selector", title: "My Templates", show_info: true },
          ],
        },
      ],
    };
    expect(findDeclutteringSelectorConfig(config)).toEqual({
      title: "My Templates",
      show_info: true,
    });
  });

  it("finds a matching card nested inside a stack-type card's own cards array", () => {
    const config = {
      views: [
        {
          cards: [
            {
              type: "vertical-stack",
              cards: [{ type: "custom:decluttering-selector", dedicated_picker: true }],
            },
          ],
        },
      ],
    };
    expect(findDeclutteringSelectorConfig(config)).toEqual({ dedicated_picker: true });
  });

  it("finds a matching card nested two levels deep inside stacked stack-type cards", () => {
    const config = {
      views: [
        {
          cards: [
            {
              type: "horizontal-stack",
              cards: [
                {
                  type: "vertical-stack",
                  cards: [{ type: "custom:decluttering-selector", title: "Deep" }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(findDeclutteringSelectorConfig(config)).toEqual({ title: "Deep" });
  });

  it("finds a matching card inside a view's badges array", () => {
    const config = {
      views: [{ badges: [{ type: "custom:decluttering-selector", title: "Badge Loader" }] }],
    };
    expect(findDeclutteringSelectorConfig(config)).toEqual({ title: "Badge Loader" });
  });

  it("finds a matching card inside sections[].cards for a sections-view dashboard", () => {
    const config = {
      views: [
        {
          sections: [
            { cards: [{ type: "custom:decluttering-selector", title: "Sections Loader" }] },
          ],
        },
      ],
    };
    expect(findDeclutteringSelectorConfig(config)).toEqual({ title: "Sections Loader" });
  });

  it("returns undefined when no card of that type exists anywhere in the config", () => {
    const config = { views: [{ cards: [{ type: "some-other-card" }] }] };
    expect(findDeclutteringSelectorConfig(config)).toBeUndefined();
  });

  it("returns undefined without throwing when views is missing", () => {
    expect(findDeclutteringSelectorConfig({})).toBeUndefined();
  });

  it("returns undefined without throwing when views is an empty array", () => {
    expect(findDeclutteringSelectorConfig({ views: [] })).toBeUndefined();
  });

  it("returns undefined without throwing for a malformed config where views is not an array", () => {
    expect(findDeclutteringSelectorConfig({ views: "not-an-array" } as never)).toBeUndefined();
  });

  it("returns undefined without throwing when a view's cards field is not an array", () => {
    expect(findDeclutteringSelectorConfig({ views: [{ cards: "nope" }] } as never)).toBeUndefined();
  });

  it("returns undefined without throwing when a stack card's nested cards field is malformed", () => {
    const config = {
      views: [{ cards: [{ type: "vertical-stack", cards: { not: "an-array" } }] }],
    };
    expect(findDeclutteringSelectorConfig(config as never)).toBeUndefined();
  });

  it("returns undefined without throwing when config itself is undefined", () => {
    expect(findDeclutteringSelectorConfig(undefined as never)).toBeUndefined();
  });

  it("returns undefined without throwing when config itself is null", () => {
    expect(findDeclutteringSelectorConfig(null as never)).toBeUndefined();
  });

  it("returns the first match in document order when multiple decluttering-selector cards exist across views", () => {
    const config = {
      views: [
        { cards: [{ type: "custom:decluttering-selector", title: "First" }] },
        { cards: [{ type: "custom:decluttering-selector", title: "Second" }] },
      ],
    };
    expect(findDeclutteringSelectorConfig(config)).toEqual({ title: "First" });
  });

  it("returns the first match in document order when a later match is nested and an earlier match is top-level", () => {
    const config = {
      views: [
        { cards: [{ type: "custom:decluttering-selector", title: "TopLevelFirst" }] },
        {
          cards: [
            {
              type: "vertical-stack",
              cards: [{ type: "custom:decluttering-selector", title: "NestedSecond" }],
            },
          ],
        },
      ],
    };
    expect(findDeclutteringSelectorConfig(config)).toEqual({ title: "TopLevelFirst" });
  });

  it("excludes the type field from the returned config", () => {
    const config = {
      views: [{ cards: [{ type: "custom:decluttering-selector", title: "T" }] }],
    };
    const result = findDeclutteringSelectorConfig(config);
    expect(result).not.toHaveProperty("type");
  });

  it("returns an object with no other fields when the matching card has no config beyond type", () => {
    const config = {
      views: [{ cards: [{ type: "custom:decluttering-selector" }] }],
    };
    expect(findDeclutteringSelectorConfig(config)).toEqual({});
  });

  it("does not throw on a circular config (a stack card whose cards array contains itself)", () => {
    const selfReferencing: Record<string, unknown> = { type: "vertical-stack" };
    selfReferencing.cards = [selfReferencing];
    const config = { views: [{ cards: [selfReferencing] }] };
    expect(() => findDeclutteringSelectorConfig(config as never)).not.toThrow();
    expect(findDeclutteringSelectorConfig(config as never)).toBeUndefined();
  });

  it("does not throw on a circular config where an ancestor card is re-referenced by a descendant", () => {
    const outer: Record<string, unknown> = { type: "vertical-stack" };
    const inner: Record<string, unknown> = { type: "horizontal-stack", cards: [outer] };
    outer.cards = [inner];
    const config = { views: [{ cards: [outer] }] };
    expect(() => findDeclutteringSelectorConfig(config as never)).not.toThrow();
    expect(findDeclutteringSelectorConfig(config as never)).toBeUndefined();
  });

  it("still finds a match that appears before a circular sibling card, without throwing", () => {
    const loopCard: Record<string, unknown> = { type: "vertical-stack" };
    loopCard.cards = [loopCard];
    const config = {
      views: [
        {
          cards: [{ type: "custom:decluttering-selector", title: "Found" }, loopCard],
        },
      ],
    };
    expect(() => findDeclutteringSelectorConfig(config as never)).not.toThrow();
    expect(findDeclutteringSelectorConfig(config as never)).toEqual({ title: "Found" });
  });
});
