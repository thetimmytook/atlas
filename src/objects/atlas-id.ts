/** IDs are opaque and remain stable for the lifetime of the object. */
export function AtlasId(): string {
  return crypto.randomUUID();
}
