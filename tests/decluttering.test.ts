import { describe, it, expect } from 'vitest';
import {
  safeTagName,
  extractTemplates,
  buildStubConfig,
  analyzeTemplates,
  getDeclutteringTemplates,
} from '../src/decluttering';
import type { DeclutteringTemplate, DeclutteringTemplates, TemplateMeta } from '../src/types';

describe('safeTagName', () => {
  it('lowercases and replaces illegal characters with a single hyphen', () => {
    expect(safeTagName('My_Template!')).toBe('my-template');
  });

  it('collapses repeated separators into a single hyphen', () => {
    expect(safeTagName('a__b')).toBe('a-b');
    expect(safeTagName('a---b')).toBe('a-b');
  });

  it('trims leading and trailing hyphens produced by illegal-character replacement', () => {
    expect(safeTagName('!!!leading')).toBe('leading');
    expect(safeTagName('trailing!!!')).toBe('trailing');
    expect(safeTagName('--Foo--')).toBe('foo');
  });

  it('prefixes with t- when the sanitized result starts with a digit', () => {
    expect(safeTagName('1foo')).toBe('t-1foo');
  });

  it('does not prefix when the sanitized name does not start with a digit', () => {
    expect(safeTagName('foo1')).toBe('foo1');
  });

  it('returns an empty string for empty input', () => {
    expect(safeTagName('')).toBe('');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(safeTagName('   ')).toBe('');
  });

  it('returns an empty string for input made entirely of illegal characters', () => {
    expect(safeTagName('!!!')).toBe('');
  });

  it('replaces unicode characters as illegal and trims the resulting hyphen', () => {
    expect(safeTagName('café')).toBe('caf');
  });

  it('leaves already-legal lowercase alphanumeric-and-hyphen names unchanged', () => {
    expect(safeTagName('already-legal-123')).toBe('already-legal-123');
  });
});

describe('extractTemplates', () => {
  it('returns the decluttering_templates map when present', () => {
    const templates: DeclutteringTemplates = { foo: { card: { type: 'x' } } };
    expect(extractTemplates({ decluttering_templates: templates })).toBe(templates);
  });

  it('returns an empty object when decluttering_templates is absent', () => {
    expect(extractTemplates({})).toEqual({});
  });

  it('returns an empty object when decluttering_templates is explicitly an empty object', () => {
    expect(extractTemplates({ decluttering_templates: {} })).toEqual({});
  });
});

describe('buildStubConfig', () => {
  it('sets type to custom:decluttering-card and template to the given name', () => {
    const result = buildStubConfig('My Template', {});
    expect(result.type).toBe('custom:decluttering-card');
    expect(result.template).toBe('My Template');
  });

  it('returns an empty variables array when the template has no default', () => {
    const result = buildStubConfig('T', {});
    expect(result.variables).toEqual([]);
  });

  it('converts a flat-object default into an array of single-key objects', () => {
    const result = buildStubConfig('T', { default: { x: 'foo', y: 'bar' } });
    expect(result.variables).toEqual([{ x: 'foo' }, { y: 'bar' }]);
  });

  it('merges an array-of-objects default and expresses it as an array of single-key objects', () => {
    const result = buildStubConfig('T', { default: [{ a: 1 }, { b: 2 }] });
    expect(result.variables).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('lets later entries in an array-of-objects default override earlier ones for the same key', () => {
    const result = buildStubConfig('T', { default: [{ a: 1 }, { a: 2 }] });
    expect(result.variables).toEqual([{ a: 2 }]);
  });

  it('treats a string default as no defaults rather than spreading its characters', () => {
    const result = buildStubConfig('T', {
      default: 'not-an-object' as unknown as DeclutteringTemplate['default'],
    });
    expect(result.variables).toEqual([]);
  });

  it('treats a number default as no defaults', () => {
    const result = buildStubConfig('T', {
      default: 42 as unknown as DeclutteringTemplate['default'],
    });
    expect(result.variables).toEqual([]);
  });

  it('treats a boolean default as no defaults', () => {
    const result = buildStubConfig('T', {
      default: true as unknown as DeclutteringTemplate['default'],
    });
    expect(result.variables).toEqual([]);
  });

  it('treats a null default as no defaults', () => {
    const result = buildStubConfig('T', {
      default: null as unknown as DeclutteringTemplate['default'],
    });
    expect(result.variables).toEqual([]);
  });
});

describe('analyzeTemplates', () => {
  it('returns an empty array for an empty templates map', () => {
    expect(analyzeTemplates({})).toEqual([]);
  });

  it('counts a placeholder referenced more than once as a single variable', () => {
    const templates: DeclutteringTemplates = {
      'My Template': {
        card: {
          type: 'custom:mushroom-light-card',
          entity: '[[entity]]',
          name: '[[entity]] Light',
        },
        default: { entity: 'light.kitchen' },
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.variableCount).toBe(1);
  });

  it('finds placeholders nested inside nested object values', () => {
    const templates: DeclutteringTemplates = {
      Nested: {
        card: {
          type: 'x',
          nested: { deeper: { color: '[[color]]' } },
        },
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.variableCount).toBe(1);
    expect(meta.requiredVariables).toEqual(['color']);
  });

  it('lists variables with no corresponding default key as required', () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: '[[entity]]', color: '[[color]]' },
        default: { entity: 'light.x' },
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.requiredVariables).toEqual(['color']);
  });

  it('marks all found variables as required when the template has no default', () => {
    const templates: DeclutteringTemplates = {
      T: { card: { entity: '[[entity]]', color: '[[color]]' } },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(['color', 'entity']);
  });

  it('derives safeName from the template key using the same rules as safeTagName', () => {
    const templates: DeclutteringTemplates = { 'My_Template!': { card: {} } };
    const [meta] = analyzeTemplates(templates);
    expect(meta.safeName).toBe(safeTagName('My_Template!'));
  });

  it('includes a stubConfig equivalent to calling buildStubConfig directly', () => {
    const template: DeclutteringTemplate = {
      card: { entity: '[[entity]]' },
      default: { entity: 'light.x' },
    };
    const templates: DeclutteringTemplates = { T: template };
    const [meta] = analyzeTemplates(templates);
    expect(meta.stubConfig).toEqual(buildStubConfig('T', template));
  });

  it('reads placeholders from element-mode templates when card is absent', () => {
    const templates: DeclutteringTemplates = {
      E: { element: { type: 'icon', icon: '[[icon]]' } },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.variableCount).toBe(1);
    expect(meta.requiredVariables).toEqual(['icon']);
  });

  it('produces one meta entry per template key, preserving the name field', () => {
    const templates: DeclutteringTemplates = {
      A: { card: {} },
      B: { card: {} },
    };
    const metas = analyzeTemplates(templates);
    expect(metas.map((m: TemplateMeta) => m.name).sort()).toEqual(['A', 'B']);
  });

  it('marks all placeholders required when default is a string, same as no default at all', () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: '[[entity]]', color: '[[color]]' },
        default: 'nonsense' as unknown as DeclutteringTemplate['default'],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(['color', 'entity']);
  });

  it('marks all placeholders required when default is a number, same as no default at all', () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: '[[entity]]', color: '[[color]]' },
        default: 7 as unknown as DeclutteringTemplate['default'],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(['color', 'entity']);
  });

  it('marks all placeholders required when default is a boolean, same as no default at all', () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: '[[entity]]', color: '[[color]]' },
        default: false as unknown as DeclutteringTemplate['default'],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(['color', 'entity']);
  });

  it('marks all placeholders required when default is null, same as no default at all', () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: '[[entity]]', color: '[[color]]' },
        default: null as unknown as DeclutteringTemplate['default'],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect([...meta.requiredVariables].sort()).toEqual(['color', 'entity']);
  });

  it('produces an empty variables array in stubConfig when default is a malformed string, matching buildStubConfig', () => {
    const templates: DeclutteringTemplates = {
      T: {
        card: { entity: '[[entity]]' },
        default: 'nonsense' as unknown as DeclutteringTemplate['default'],
      },
    };
    const [meta] = analyzeTemplates(templates);
    expect(meta.stubConfig.variables).toEqual([]);
  });
});

describe('getDeclutteringTemplates', () => {
  it('returns the decluttering_templates map from hass.lovelace.config, equivalent to extractTemplates', () => {
    const templates: DeclutteringTemplates = { foo: { card: { type: 'x' } } };
    const config = { decluttering_templates: templates };
    const hass = { lovelace: { config } };
    expect(getDeclutteringTemplates(hass)).toEqual(extractTemplates(config));
  });

  it('returns an empty object when hass.lovelace.config is present but decluttering_templates is absent', () => {
    const hass = { lovelace: { config: {} } };
    expect(getDeclutteringTemplates(hass)).toEqual({});
  });

  it('returns an empty object when hass.lovelace.config has decluttering_templates explicitly empty', () => {
    const hass = { lovelace: { config: { decluttering_templates: {} } } };
    expect(getDeclutteringTemplates(hass)).toEqual({});
  });

  it('throws when hass.lovelace is undefined', () => {
    const hass = {};
    expect(() => getDeclutteringTemplates(hass)).toThrow();
  });

  it('throws when hass.lovelace is present but hass.lovelace.config is undefined', () => {
    const hass = { lovelace: {} };
    expect(() => getDeclutteringTemplates(hass)).toThrow();
  });

  it('throws LovelaceUnavailableError (not a generic TypeError) when hass itself is undefined', () => {
    expect(() => getDeclutteringTemplates(undefined)).toThrow();
    try {
      getDeclutteringTemplates(undefined);
    } catch (error) {
      expect((error as Error).name).toBe('LovelaceUnavailableError');
    }
  });

  it('throws LovelaceUnavailableError (not a generic TypeError) when hass itself is null', () => {
    expect(() => getDeclutteringTemplates(null)).toThrow();
    try {
      getDeclutteringTemplates(null);
    } catch (error) {
      expect((error as Error).name).toBe('LovelaceUnavailableError');
    }
  });

  it('throws an error identifiable as "unavailable" so a caller can distinguish it from other errors', () => {
    const hass = {};
    expect.assertions(3);
    try {
      getDeclutteringTemplates(hass);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe('LovelaceUnavailableError');
      expect((error as Error).message.length).toBeGreaterThan(0);
    }
  });

  it('throws the same identifiable error type regardless of whether lovelace or lovelace.config is the missing piece', () => {
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

    expect(firstErrorName).toBe('LovelaceUnavailableError');
    expect(secondErrorName).toBe('LovelaceUnavailableError');
  });
});
