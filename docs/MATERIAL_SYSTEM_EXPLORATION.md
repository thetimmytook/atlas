# Atlas materials and a future appearance system

Status: exploratory note, not a specification or first-version scope.
Source: the user's chat notes and [pre-design.pdf](references/pre-design.pdf),
two pages. The PDF is preserved unchanged. Its syntax examples are sketches,
not implementation instructions. Current decisions: [DESIGN_MAIN.md](DESIGN_MAIN.md).

## Proposals in the original notes

The PDF describes: no automatic cascade through the HTML hierarchy; checking
appearance applicability against element type (applicability by ID is left open);
typed variables; enums that reject invalid values; appearance definitions with
typed parameters, optional arguments, and defaults; parameterized classes;
passing a complete appearance definition to internal elements; a separate contract
for a component's supported appearance without specifying concrete visuals,
including for headless components. Page two explores applying and implementing
that contract rather than presenting a finished grammar.

Additional chat ideas: isolation per component/module; separating element kinds
so that text and other properties do not end up in one universal object; avoiding
large numbers of utility classes; variables and positioning; selectors as an open
question; an explicit public component-appearance interface; grouping properties
under a parent concept (for example, flex and its parameters); binding a property
to another element/class property; a small core and standard component library;
independence from markup and appearance languages.

## Accepted directions for Atlas

After discussion, the user confirmed the directions below. These are architectural
principles, not approval of example signatures or immediate implementation.
Isolation and explicit inheritance were already accepted; they are not new decisions here.

1. **Separate contracts from materials.** An extension/object kind declares supported
   parameters and their meaning. A material supplies values. This does not make a material
   create a label or own its lifecycle; that is the node behavior's responsibility.
2. **Types and applicability.** Enums, defaults, units, and checks against object
   capabilities. Not every node must accept font parameters, and not every behavior
   parameter must come from a material.
3. **Isolation and explicit dependencies.** The already agreed named material inheritance
   is preferable to an implicit cascade through the map tree or layers.
   Material inheritance should not depend on layer membership.
4. **Parameter grouping.** Stroke parameters, for example, may be grouped together.
   Grouping organizes the contract; it does not automatically enable behavior.
   Deep inheritance and replacement of nested groups need separate definition.
5. **Exposed composite-object parts.** A route/marker may explicitly expose appearance
   contracts for its line, icon, or label without exposing internal DOM. This could adapt
   the headless-component idea; the exact slot model has not been selected.
6. **Renderer and syntax independence.** The semantic contract should be shared by
   SVG/Canvas/WebGL. JS/JSON is sufficient as the first representation;
   validating the idea does not require a custom text language.
7. **Small core and standard extensions.** Registered properties, behavior, and predefined
   appearance can be validated using label. Built-in capabilities should remain available
   without manual configuration by developers.

Do not move HTML types, DOM selectors, or UI components such as buttons into Atlas core.
Their equivalents, if needed, belong to a more general future system.

## Validating the concept with label

The user agreed that a proof of concept is needed but did not request coding to start.
Check registration of a typed placement property, its default, diagnostics for invalid
values, correct responses to runtime-property changes, separation of label behavior
from appearance, no direct SVG dependency in the shared handler, and updates within
batch. These are validation recommendations, not approved signatures or a mandatory test scope.

Before implementation, resolve this: label is currently accepted as optional text.
The example path label.position does not mean label has already become an object.
Text storage, placement parameters, and visual parameters need a schema.

## Decision points

- Which parameters belong to the material, and which to the behavior/node?
- How are properties registered: explicit calls, annotations, or both?
- How are types, units, applicability, and diagnostic paths expressed?
- How do nested groups inherit, and how does a value revert to its inherited value?
- Are parameterized materials needed beyond inherits and ordinary runtime properties?
- Which composite-object parts may be styled externally?
- How do multiple states, temporary effects, and application changes interact?
- alter/replace/reset remain decision points, not a final API.

## Deprecation and compatibility

- The user requested marking properties deprecated with warnings on use.
  Registration format and warning policy remain open.
- Future pluggable polyfills/adapters for removed properties should avoid retaining
  obsolete implementations in the core indefinitely.
- Direction: compatibility is implemented through extensions. Transforming old values/
  behavior, versions, registration conflicts, and diagnostics still need design work.
- This does not promise restoration of every removed behavior: feasibility depends
  on current core capabilities. This is a technical limitation, not an approved policy.

## Very distant future — a separate direction

At the user's explicit request, preserve the possibility of developing a complete,
standalone style/material system. This is not a condition for releasing Atlas.

Possible research: an independent typed-property/material core; component appearance
contracts; parameterization and variables/tokens; different language adapters over one
model; positioning/layout as extensions; a behavior registry; a standard library;
selectors only when their necessity is demonstrated.

The user explicitly confirmed deferring cross-property bindings, a parameterized
language, selectors, and a general layout engine.

Binding one property to another is a particularly separate topic: it needs a dependency
graph, cycle detection, evaluation order, invalidation, subscription cleanup, and clear
diagnostics. It must not emerge unnoticed as arbitrary setters calling one another.
Avoid a network of utility classes as the primary API.

If Atlas prototypes demonstrate the value of a general mechanism, extracting a separate
package/project can be considered. No package extraction, DSL, or general layout engine
is currently approved for implementation.
