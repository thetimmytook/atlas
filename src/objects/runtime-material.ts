import type { Material, MaterialProperties } from '#definitions/material-definition.js';

/** Internal handle; the lookup exposes only the Material interface. */
export class RuntimeMaterial implements Material {
  readonly name: string;
  readonly inherits?: string;
  #properties: MaterialProperties;
  readonly #replace: (name: string, properties: MaterialProperties) => void;

  constructor(
    name: string,
    properties: MaterialProperties,
    inherits: string | undefined,
    replace: (name: string, properties: MaterialProperties) => void,
  ) {
    this.name = name;
    this.#properties = properties;

    if (inherits !== undefined) {
      this.inherits = inherits;
    }

    this.#replace = replace;
    Object.freeze(this);
  }

  get properties(): MaterialProperties {
    return this.#properties;
  }

  set properties(value: MaterialProperties) {
    this.#replace(this.name, value);
  }

  commitProperties(value: MaterialProperties): void {
    this.#properties = value;
  }
}
