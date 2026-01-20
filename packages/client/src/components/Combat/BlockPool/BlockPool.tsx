/**
 * BlockPool - Displays accumulated block in a simple layout.
 *
 * Unlike attack pool (which has Ranged/Siege/Melee sections),
 * block pool is simpler: just shows elements (physical, fire, ice, coldFire).
 */

import type { AvailableBlockPool, AttackElement } from "@mage-knight/shared";
import { BlockChip } from "./BlockChip";
import "../AttackPool/AttackPool.css";

interface BlockPoolProps {
  availableBlock: AvailableBlockPool;
}

// All block elements in display order
const BLOCK_ELEMENTS: AttackElement[] = ["physical", "fire", "ice", "coldFire"];

// Get block amount for an element
function getAmount(pool: AvailableBlockPool, element: AttackElement): number {
  return pool[element] ?? 0;
}

// Calculate total block
function getTotal(pool: AvailableBlockPool): number {
  return BLOCK_ELEMENTS.reduce((sum, el) => sum + getAmount(pool, el), 0);
}

export function BlockPool({ availableBlock }: BlockPoolProps) {
  const total = getTotal(availableBlock);

  if (total === 0) {
    return null;
  }

  // Filter to only elements with amounts
  const activeElements = BLOCK_ELEMENTS.filter(el => getAmount(availableBlock, el) > 0);

  return (
    <div className="block-pool">
      <div className="block-pool__section">
        <div className="block-pool__section-header">
          <span className="block-pool__section-title">Block</span>
          <span className="block-pool__section-total">{total}</span>
        </div>
        <div className="block-pool__chips">
          {activeElements.map((element) => (
            <BlockChip
              key={element}
              element={element}
              amount={getAmount(availableBlock, element)}
              disabled={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
