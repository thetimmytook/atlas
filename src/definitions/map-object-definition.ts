/** Common object data. Material, label, and data contracts will extend this foundation. */
export interface MapObjectDefinition {
  readonly id?: string;
  readonly kind: string;
}
