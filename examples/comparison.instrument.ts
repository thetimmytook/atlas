/* eslint-disable @typescript-eslint/unbound-method -- Restored originals use explicit .call(this). */
/** DOM counters only. Canvas drawing work is deliberately N/A, never reported as zero. */
export function instrumentSvg(): {
  reset(): void;
  finish(): Record<string, number>;
  restore(): void;
} {
  let writes = 0;
  let removals = 0;
  const attribute = Element.prototype.setAttribute;
  const removeAttribute = Element.prototype.removeAttribute;

  Element.prototype.setAttribute = function (name, value): void {
    if (this instanceof SVGElement) {
      writes += 1;
    }

    attribute.call(this, name, value);
  };

  Element.prototype.removeAttribute = function (name): void {
    if (this instanceof SVGElement) {
      removals += 1;
    }

    removeAttribute.call(this, name);
  };

  const records: MutationRecord[] = [];
  const collect = new MutationObserver(batch => records.push(...batch));
  collect.observe(document.getElementById('stage')!, { childList: true, subtree: true });

  return {
    reset(): void {
      writes = 0;
      removals = 0;
      records.length = 0;
      collect.takeRecords();
      const shadow = document.querySelector('atlas-map')?.shadowRoot;

      if (shadow) {
        collect.observe(shadow, { childList: true, subtree: true });
      }
    },
    finish(): Record<string, number> {
      const all = records.concat(collect.takeRecords());

      return {
        svg_attribute_writes: writes,
        svg_attribute_removals: removals,
        dom_added_nodes: all.reduce((sum, record) => sum + record.addedNodes.length, 0),
        dom_removed_nodes: all.reduce((sum, record) => sum + record.removedNodes.length, 0),
      };
    },
    restore(): void {
      Element.prototype.setAttribute = attribute;
      Element.prototype.removeAttribute = removeAttribute;
      collect.disconnect();
    },
  };
}
