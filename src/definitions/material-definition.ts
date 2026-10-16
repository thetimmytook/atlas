import type { Point2 } from '#math/point2.js';
import type { Size } from '#math/size.js';
import type { MapObject } from '#objects/map-object.js';
import type { MapEntryDefinition } from './map-definition.js';

export type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface PropertyReadObject {
  readonly id: MapObject['id'];
  readonly kind: MapEntryDefinition['kind'];
  readonly data?: JsonObject;
}

export interface PropertyRegistration {
  readonly name: string;
  readonly valueType: 'string' | 'number' | 'boolean';
  readonly optional: boolean;
  readonly appliesTo: readonly MapEntryDefinition['kind'][];
  readonly read: (object: PropertyReadObject) => unknown;
}

export interface MapConfiguration {
  readonly properties: readonly PropertyRegistration[];
}

export type MaterialScalar = string | number | boolean;
export type MaterialConditionValue =
  MaterialScalar | readonly string[] | readonly number[] | readonly boolean[];

export interface MaterialCondition {
  readonly kind: MapEntryDefinition['kind'] | readonly MapEntryDefinition['kind'][];
  readonly [name: string]: MaterialConditionValue;
}

export interface MaterialRule {
  readonly when: MaterialCondition;
  readonly material: string;
}

export interface MaterialDefinition {
  readonly properties: MaterialProperties;
  readonly inherits?: string;
}

export interface ImageResourceDefinition {
  readonly kind: 'image';
  readonly source: string;
}

// eslint-disable-next-line sonarjs/redundant-type-aliases -- Public contract distinguishes resource IDs from material names and source URLs without branding.
export type ImageResourceId = string;

export interface PointImage extends Partial<Size> {
  readonly resource: ImageResourceId;
  readonly preserveAspectRatio?: boolean;
  readonly anchor?: Point2;
}

/**
 * Limits units only; runtime also requires a finite decimal without surrounding
 * whitespace, exponents or hexadecimal notation. TypeScript may accept values
 * such as '1e2px', '0x10px' or ' 2px' that runtime validation rejects.
 */
export type LabelLength = `${number}px` | `${number}rem`;

export type LabelOrigin =
  | 'top left'
  | 'top center'
  | 'top right'
  | 'center left'
  | 'center center'
  | 'center right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right';

/** One atomic pair; both coordinates are required. Positive x/y mean right/down. */
export interface LabelOffset {
  readonly x: LabelLength;
  readonly y: LabelLength;
}

export interface LabelFontProperties {
  readonly size?: LabelLength;
  readonly family?: string;
  readonly weight?: 'normal' | 'bold';
}

/** Own declarations only. Visual resolution, including font-field inheritance, is a later step. */
export interface LabelProperties {
  readonly color?: string;
  readonly font?: LabelFontProperties;
  readonly origin?: LabelOrigin;
  readonly offset?: LabelOffset;
}

export interface MaterialProperties {
  readonly symbol?: 'none' | 'circle' | 'image';
  readonly color?: string;
  readonly size?: number;
  readonly width?: number;
  readonly opacity?: number;
  readonly image?: PointImage;
  readonly label?: LabelProperties;
}

/** Map-owned handle. Properties are copied own declarations, not resolved defaults. */
export interface Material {
  readonly name: string;
  readonly inherits?: string;
  get properties(): MaterialProperties;
  set properties(value: MaterialProperties);
}

/** Provisional named lookup; no public constructors or mutable registry. */
export interface MaterialLookup {
  get(name: string): Material | undefined;
}
