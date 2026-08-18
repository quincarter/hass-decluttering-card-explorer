import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../src/decluttering-selector';
import { safeTagName } from '../src/decluttering';
import type { DeclutteringTemplate, DeclutteringTemplates } from '../src/types';

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
  const cls = customElements.get('decluttering-selector');
  if (!cls) {
    throw new Error('decluttering-selector is not registered on customElements');
  }
  return cls as CustomElementConstructor & { getStubConfig?: () => unknown };
}

function createElement(): SelectorElement {
  return document.createElement('decluttering-selector') as SelectorElement;
}

function typeForName(name: string): string {
  return `decluttering-card-${safeTagName(name)}`;
}

function makeTemplates(prefix: string, count: number): DeclutteringTemplates {
  const templates: DeclutteringTemplates = {};
  for (let i = 0; i < count; i += 1) {
    templates[`${prefix}-template-${i}`] = {
      card: { type: 'x', entity: `[[entity${i}]]` },
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

describe('decluttering-selector registration', () => {
  it('registers a custom element under the decluttering-selector tag', () => {
    expect(customElements.get('decluttering-selector')).toBeDefined();
  });
});

describe('getStubConfig', () => {
  it('returns the custom:decluttering-selector stub config', async () => {
    const cls = getElementClass();
    expect(typeof cls.getStubConfig).toBe('function');
    const stub = await cls.getStubConfig!();
    expect(stub).toEqual({ type: 'custom:decluttering-selector' });
  });
});

describe('setConfig', () => {
  it('does not throw when called with an empty object', () => {
    const el = createElement();
    expect(() => el.setConfig!({})).not.toThrow();
  });

  it('does not throw when called with undefined', () => {
    const el = createElement();
    expect(() => el.setConfig!(undefined)).not.toThrow();
  });

  it('accepts an optional title field without throwing', () => {
    const el = createElement();
    expect(() => el.setConfig!({ title: 'My Templates' })).not.toThrow();
  });
});

describe('registration from hass.lovelace.config', () => {
  it('registers every template found under decluttering_templates into window.customCards', async () => {
    const templates = makeTemplates('lovelace-basic', 2);
    const el = createElement();
    document.body.appendChild(el);

    el.hass = makeHass(templates);
    await flush(el);

    const expectedTypes = Object.keys(templates).map(typeForName);
    for (const type of expectedTypes) {
      expect(window.customCards!.some((c) => c.type === type)).toBe(true);
    }
    expect(window.customCards).toHaveLength(2);

    document.body.removeChild(el);
  });
});

describe('registration fallback via hass.callWS', () => {
  it('calls hass.callWS with lovelace/config when hass.lovelace is absent and registers the resolved templates', async () => {
    const templates = makeTemplates('ws-fallback', 2);
    const callWS = vi.fn().mockResolvedValue({ decluttering_templates: templates });
    const hass = {
      callWS,
      connection: { subscribeEvents: vi.fn().mockResolvedValue(() => {}) },
    };

    const el = createElement();
    document.body.appendChild(el);

    el.hass = hass;
    await flush(el);

    expect(callWS).toHaveBeenCalledWith({ type: 'lovelace/config' });

    const expectedTypes = Object.keys(templates).map(typeForName);
    for (const type of expectedTypes) {
      expect(window.customCards!.some((c) => c.type === type)).toBe(true);
    }
    expect(window.customCards).toHaveLength(2);

    document.body.removeChild(el);
  });
});

describe('render', () => {
  it('does not throw and produces shadow DOM content when hass is entirely unset', async () => {
    const el = createElement();
    expect(() => document.body.appendChild(el)).not.toThrow();
    await flush(el);

    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.childNodes.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it('does not throw when a template has neither card nor element', async () => {
    const templates: DeclutteringTemplates = {
      'malformed-no-card-or-element': {} as DeclutteringTemplate,
    };
    const el = createElement();
    document.body.appendChild(el);

    expect(() => {
      el.hass = makeHass(templates);
    }).not.toThrow();
    await flush(el);

    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.childNodes.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it('does not throw when default is an unexpected type like a string', async () => {
    const templates: DeclutteringTemplates = {
      'malformed-string-default': {
        card: { type: 'x' },
        default: 'not-an-object' as unknown as DeclutteringTemplate['default'],
      },
    };
    const el = createElement();
    document.body.appendChild(el);

    expect(() => {
      el.hass = makeHass(templates);
    }).not.toThrow();
    await flush(el);

    expect(el.shadowRoot).toBeTruthy();
    expect(el.shadowRoot!.childNodes.length).toBeGreaterThan(0);

    document.body.removeChild(el);
  });
});

describe('unsubscribe on disconnect', () => {
  it('calls the unsubscribe function returned by connection.subscribeEvents when the element is removed from the DOM', async () => {
    const templates = makeTemplates('unsub', 1);
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

describe('idempotent re-registration', () => {
  it('does not duplicate window.customCards entries when hass is set twice with the same templates', async () => {
    const templates = makeTemplates('idempotent-set-twice', 3);
    const el = createElement();
    document.body.appendChild(el);

    const firstHass = makeHass(templates);
    el.hass = firstHass;
    await flush(el);

    const secondHass = makeHass(templates);
    el.hass = secondHass;
    await flush(el);

    expect(window.customCards).toHaveLength(3);

    document.body.removeChild(el);
  });
});
