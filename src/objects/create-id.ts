/** IDs are opaque and remain stable for the lifetime of the object. */
export function createId(): string {
  return crypto.randomUUID();
}
