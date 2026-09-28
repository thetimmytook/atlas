export interface AtlasErrorOptions extends ErrorOptions {
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class AtlasError extends Error {
  readonly code: string;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, options: AtlasErrorOptions) {
    super(message, options);
    this.name = 'AtlasError';
    this.code = options.code;
    this.details = Object.freeze({ ...options.details });
  }
}
