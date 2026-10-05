/** Require an existing ID without changing the definition's other properties. */
export type WithId<T extends { readonly id?: string }> = T & {
  readonly id: string;
};
