# Materials

[Navigation and current summary](../DESIGN_MAIN.md)

Moved from the discussion log without losing context. Clarifications take precedence
over earlier proposals; explicitly open questions are not decisions.

## Appearance — clarification replacing Meta

### Current decision: explicit material relationships

- Accepted foundation: named materials, explicit inheritance, and material assignment
  to objects. A name such as line.base is an arbitrary identifier; the dot does not
  define a hierarchy. The relationship is explicit through a parent (provisional inherits field).
- Unspecified properties inherit from the explicitly specified parent; a material's
  own values override inherited ones. Built-in materials allow maps to work without
  manually defining their appearance.
- Motivation: explicit dependencies and encapsulation instead of an implicit CSS-like cascade.
- Confirmed: specificity kind → kind + type → object selects one assigned material
  rather than blending properties from materials at these levels. Properties resolve
  only through the selected material's explicit inheritance chain.
- Each kind has a built-in material; the application may assign materials by kind/type
  and explicitly to a particular object. More specific assignments take precedence.
  Example: marker {color: gray, size: 24}; extract inherits marker and sets green;
  special inherits extract and sets size: 32. An object using special is green with size 32.
  The exact assignment-table schema is not defined yet.
- A route defines the default material for its lines. An individual line may use
  another material; it replaces the route's selection without implicit property mixing.
  Property inheritance still occurs only through inherits. The specific reassignment
  mechanism/API will be discussed later; the user explicitly left it open.

### Decision points: material operations and behavior

- alter/replace/reset are open decision points again: the provisionally accepted
  semantics below are retained as history, not a final API commitment.
- alter: is a separate property-merging method needed if explicit inheritance
  already describes partial overrides? Changing runtime properties and describing
  inheritance are different operations; the final API has not been chosen.
- replace: what is replaced — the assigned material, instance parameters,
  or a behavior's temporary appearance? Its scope is not defined yet.
- reset: which state should it restore, and which changes should it remove? A generic
  reset must not implicitly undo independent changes by the application or other behaviors.
- Hover and other effects are considered together with future behavior registration:
  an effect may be defined by a registered behavior or a property change. Applying/removing
  effects and composing simultaneous changes need definition.
- The user supplied these remarks as architectural context, not as a request
  to define signatures or implement the system immediately.

Latest clarification: the user restores material/materials instead of styles.
No separate style concept is introduced on top of the previously chosen materials.
Exact API names and the separation of material registry and assignment rules are still discussed.
Three application levels are accepted: kind → kind + type → specific object;
the more specific level overrides specified properties. Built-in appearance,
partial overrides, and updates independent of data remain.
The user confirmed specificity as an Atlas approach that can be adapted later.
Source/Unreal were discussed only as examples; their architecture, shader graphs,
or material-instance hierarchy need not be reproduced.
References to styles below describe the earlier name and yield to this clarification.

- The public term styles for appearance rules was agreed. The name theme is not
  used as the primary contract. The former Meta container needs revision;
  earlier references reflect prior discussions, not the final API.
- Atlas provides built-in appearance: a map works without custom styles. Base styles
  cover supported kinds, labels, route points, and highlighting. An unknown semantic
  type receives the base appearance of its kind.
- Custom styles override only the necessary parts of built-in appearance;
  the application need not supply a complete rule set.
- Styles can be supplied when creating a map and changed at runtime independently
  of object data, without recreating objects. Illustrative example: map.styles = customStyles.
- Styles are Atlas's own renderer-independent contract, not CSS. Materials may remain
  an internal/component concept, but the exact structure, rule priorities, and styles
  update mechanism are not yet defined.
- Appearance is separate from event handling and behavior; earlier behaviors in Meta
  do not automatically carry over into styles.
- Currently agreed object runtime-material semantics:
  alter(properties) merges local overrides, changing only supplied properties
  (not arithmetic addition); replace(properties) completely replaces local overrides;
  reset() removes them and restores appearance resolved through kind/type and built-in values.
- Properties unspecified after replace inherit from the base material rather than
  becoming undefined. Changing object.material affects only that object, not a shared
  material used by other objects.
- The application may call these operations on hover/click or other events; special
  built-in hovered/selected states are unnecessary. Nested-property details and
  management of simultaneous effects are undefined. The user accepted these semantics
  provisionally ("for now, yes").
- User-confirmed extension direction: registering named behaviors/classifiers to link
  events, states, and materials flexibly. Hover is a possible example, not a mandatory
  fixed state set. The example XXX.register("hover", onClick()) illustrates the idea,
  not a specific signature or a conflation of event and state semantics.
- The current alter/replace/reset satisfy the agreed requirements. The extensible
  system will be revisited separately: state priorities, effect removal, registration
  lifecycle, and material relationships are undefined. Storing functions in runtime
  and names in JSON fits the general serializable model, but the exact registration
  contract is not yet approved.
- Automatically propagating shared-material changes while retaining local overrides
  was proposed but has not been separately confirmed.
