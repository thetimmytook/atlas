/** IDs are opaque and remain stable for the lifetime of the object. */
export function createId(): string {
  return crypto.randomUUID();
}

/** Resolve an omitted ID after all explicit IDs have been reserved. */
export function resolveObjectId(id: string | undefined, ids: Set<string>): string {
  if (id !== undefined) {
    return id;
  }

  let generated: string;

  do {
    generated = createId();
  } while (ids.has(generated));

  ids.add(generated);

  return generated;
}
