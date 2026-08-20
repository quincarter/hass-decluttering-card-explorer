import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeAssistant } from "custom-card-helpers";
import { extractTemplates, analyzeTemplates, resolveDashboardConfig } from "./decluttering";
import { registerAll, registerTemplatePickerCard } from "./register";
import "./template-picker";
import { initGlobalRegistration, getCurrentDashboardUrlPath } from "./global-bootstrap";
import type { DeclutteringTemplates, TemplateMeta } from "./types";

initGlobalRegistration();

interface DeclutteringSelectorConfig {
  title?: string;
  /**
   * The on-dashboard status list (title/count/template names) is off by default —
   * this card's job is registering templates into the Add Card picker, not adding
   * visible dashboard clutter. Set `show_info: true` to see it (useful while
   * confirming templates were found, or debugging why one isn't showing up).
   */
  show_info?: boolean;
  /**
   * Default (false/absent): per-template entries only, one "Add Card" picker
   * entry per decluttering template. `true`: a single "Choose a Template"
   * wrapper entry instead, no per-template entries. Both `_register()` calls
   * below always run with the current mode's booleans (not skipped), so
   * switching this mid-session correctly swaps which entries are present.
   */
  dedicated_picker?: boolean;
}

/**
 * `hass.lovelace` is NOT part of the real `HomeAssistant` object for card elements —
 * it's tracked as component-local state in HA frontend's `ha-panel-lovelace`, and
 * only ever passed down as a *separate* `.lovelace` property to view/editor
 * elements, never merged onto `hass`. This type (and `resolveDashboardConfig`'s
 * primary-path lookup that uses it) exists only as a best-effort check for
 * environments where something else happens to have set it; the `lovelace/config`
 * WS call inside `resolveDashboardConfig` — with an explicit `url_path` — is the
 * actual reliable path.
 */
type HassWithLovelace = HomeAssistant & {
  lovelace?: {
    config?: { decluttering_templates?: DeclutteringTemplates };
  };
};

export { getCurrentDashboardUrlPath } from "./global-bootstrap";

@customElement("decluttering-selector")
export class DeclutteringSelector extends LitElement {
  @property({ attribute: false }) public hass?: HassWithLovelace;

  @state() private _metas: TemplateMeta[] = [];

  private _config: DeclutteringSelectorConfig = {};
  private _subscribedToUpdates = false;
  private _unsubscribe?: () => void;

  static async getStubConfig(): Promise<{ type: string }> {
    return { type: "custom:decluttering-selector" };
  }

  public setConfig(config?: DeclutteringSelectorConfig): void {
    this._config = config ?? {};
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has("hass")) {
      void this._register();
      this._subscribeToUpdates();
    }
  }

  private _subscribeToUpdates(): void {
    if (this._subscribedToUpdates) return;
    try {
      const connection = this.hass?.connection as
        | { subscribeEvents?: (cb: () => void, event: string) => Promise<() => void> }
        | undefined;
      if (!connection?.subscribeEvents) return;
      this._subscribedToUpdates = true;
      connection
        .subscribeEvents(() => {
          void this._register();
        }, "lovelace_updated")
        .then((unsubscribe) => {
          this._unsubscribe = unsubscribe;
        })
        .catch(() => {
          this._subscribedToUpdates = false;
        });
    } catch {
      this._subscribedToUpdates = false;
    }
  }

  public disconnectedCallback(): void {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = undefined;
    }
    super.disconnectedCallback();
  }

  private async _resolveTemplates(): Promise<DeclutteringTemplates> {
    const urlPath = getCurrentDashboardUrlPath(this.hass);
    return extractTemplates(await resolveDashboardConfig(this.hass, urlPath));
  }

  private async _register(): Promise<void> {
    try {
      const templates = await this._resolveTemplates();
      const metas = analyzeTemplates(templates);
      const dedicatedPicker = this._config.dedicated_picker === true;
      registerAll(metas, { registerCards: !dedicatedPicker });
      registerTemplatePickerCard(dedicatedPicker);
      this._metas = metas;
    } catch (err) {
      console.error("decluttering-selector: failed to register templates", err);
      this._metas = [];
    }
  }

  protected render() {
    try {
      if (!this._config.show_info) return nothing;

      const count = this._metas.length;
      const title = this._config.title;
      return html`
        <div>
          ${title ? html`<h3>${title}</h3>` : null}
          <p>${count} template${count === 1 ? "" : "s"} registered into Add Card</p>
          <ul>
            ${this._metas.map((meta) => html`<li>${meta.name}</li>`)}
          </ul>
        </div>
      `;
    } catch {
      return html`<div>decluttering-selector</div>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "decluttering-selector": DeclutteringSelector;
  }
}
