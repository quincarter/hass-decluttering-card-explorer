// Minimal fake HomeAssistant for fast dev iteration without a live HA instance.
// Loaded by dev/index.html after the card element is registered.
import type { HomeAssistant } from "custom-card-helpers";

// A sample dashboard with decluttering_templates + usages so the parse/count
// logic can be exercised end-to-end in the browser.
const sampleConfig = {
  decluttering_templates: {
    light_button: {
      default: [{ icon: "lightbulb" }],
      card: {
        type: "custom:button-card",
        name: "[[name]]",
        entity: "[[entity]]",
        icon: "mdi:[[icon]]",
      },
    },
    fan_element: {
      element: {
        type: "icon",
        icon: "mdi:[[fan]]",
        entity: "[[entity]]",
      },
    },
    no_defaults: {
      card: {
        type: "markdown",
        content: "[[content]]",
      },
    },
  },
  views: [
    {
      title: "Home",
      cards: [
        {
          type: "custom:decluttering-card",
          template: "light_button",
          variables: [{ name: "Kitchen" }, { entity: "light.kitchen" }],
        },
        {
          type: "vertical-stack",
          cards: [
            {
              type: "custom:decluttering-card",
              template: "light_button",
              variables: [{ name: "Living Room" }, { entity: "light.living_room" }],
            },
            {
              type: "custom:decluttering-card",
              template: "fan_element",
              variables: [{ entity: "fan.office" }],
            },
          ],
        },
        {
          type: "horizontal-stack",
          cards: [
            {
              type: "custom:decluttering-card",
              template: "no_defaults",
              variables: [{ content: "hello" }],
            },
            { type: "custom:button-card", entity: "light.hall" },
          ],
        },
      ],
      badges: [
        {
          type: "custom:decluttering-card",
          template: "light_button",
          variables: [{ name: "Hall" }, { entity: "light.hall" }],
        },
      ],
    },
  ],
};

export const mockHass = {
  connected: true,
  states: {},
  user: { name: "dev", is_admin: true, id: "dev" },
  config: { version: "2024.1.0", location_name: "dev" },
  themes: { darkMode: false },
  selectedTheme: null,
  localize: (s: string) => s,
  lovelace: {
    config: sampleConfig,
    mode: "storage" as const,
    current_view: 0,
  },
  callWS: async (_msg: unknown): Promise<unknown> => ({
    decluttering_templates: sampleConfig.decluttering_templates,
  }),
  connection: {
    subscribeEvents: async (_cb: (ev: unknown) => void, _event: string) => (): void => {},
  },
  formatEntityState: (s: { state?: string } | null): string => s?.state ?? "",
  callService: async (): Promise<void> => {},
} as unknown as HomeAssistant;

const card = document.getElementById("card") as unknown as {
  hass: HomeAssistant;
  setConfig: (c: Record<string, unknown>) => void;
};
card.hass = mockHass;
card.setConfig({ type: "custom:decluttering-selector", title: "Decluttering Templates" });
