import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { HomeAssistant } from "custom-card-helpers";
import "./template-picker-editor";

interface DeclutteringTemplatePickerConfig {
  type: string;
  template?: string;
  variables?: unknown;
}

interface DeclutteringCardElement extends HTMLElement {
  hass?: HomeAssistant;
  setConfig(config: unknown): void;
  getCardSize?(): number | Promise<number>;
}

const CHILD_TAG = "decluttering-card";

@customElement("decluttering-template-picker")
export class DeclutteringTemplatePicker extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  private _config: DeclutteringTemplatePickerConfig = {
    type: "custom:decluttering-template-picker",
  };
  private _child?: DeclutteringCardElement;
  private _appliedTemplate?: string;
  private _appliedVariables?: string;

  static async getStubConfig(): Promise<{ type: string }> {
    return { type: "custom:decluttering-template-picker" };
  }

  static async getConfigElement(): Promise<HTMLElement> {
    return document.createElement("decluttering-template-picker-editor");
  }

  public setConfig(config?: DeclutteringTemplatePickerConfig): void {
    this._config = config ?? { type: "custom:decluttering-template-picker" };
    this._syncChild();
  }

  public getCardSize(): number | Promise<number> {
    if (this._child && typeof this._child.getCardSize === "function") {
      try {
        return this._child.getCardSize();
      } catch {
        return 1;
      }
    }
    return 1;
  }

  protected updated(changedProperties: PropertyValues): void {
    if (changedProperties.has("hass")) {
      this._syncChild();
    }
  }

  /**
   * The child decluttering-card instance is created once and reused so its own
   * internal Lit state isn't thrown away on every wrapper re-render.
   */
  private _syncChild(): void {
    if (!this._config.template) return;
    if (!customElements.get(CHILD_TAG)) return;

    const isNewChild = !this._child;
    if (!this._child) {
      this._child = document.createElement(CHILD_TAG) as DeclutteringCardElement;
    }

    const variablesKey = JSON.stringify(this._config.variables);
    if (
      isNewChild ||
      this._appliedTemplate !== this._config.template ||
      this._appliedVariables !== variablesKey
    ) {
      this._child.setConfig({
        type: "custom:decluttering-card",
        template: this._config.template,
        variables: this._config.variables,
      });
      this._appliedTemplate = this._config.template;
      this._appliedVariables = variablesKey;
    }

    if (this.hass) {
      this._child.hass = this.hass;
    }

    // Only a newly-created child needs to be scheduled into the DOM; setting
    // properties on an already-rendered child mutates that same node in place
    // and needs no re-render of this wrapper.
    if (isNewChild) {
      this.requestUpdate();
    }
  }

  protected render() {
    try {
      if (!this._config.template) {
        return html`<div>Edit this card to choose a template</div>`;
      }

      if (!customElements.get(CHILD_TAG)) {
        return html`<div>
          decluttering-card isn't installed. Install the decluttering-selector card's peer
          dependency to use this template picker.
        </div>`;
      }

      if (!this._child) {
        this._syncChild();
      }

      return this._child ?? nothing;
    } catch {
      return html`<div>decluttering-template-picker</div>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "decluttering-template-picker": DeclutteringTemplatePicker;
  }
}
