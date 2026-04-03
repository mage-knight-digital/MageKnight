import { useState, useEffect, useCallback } from "react";
import { useReplay } from "../../hooks/useReplay";
import { formatAction } from "../../utils/formatAction";
import "./PolicyInfoPanel.css";

export function PolicyInfoPanel() {
  const replay = useReplay();
  const [collapsed, setCollapsed] = useState(false);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  // Keyboard shortcut: P to toggle
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "p" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLSelectElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setCollapsed((c) => !c);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!replay) return null;

  const { currentPolicyInfo } = replay;

  const panelClass = [
    "policy-panel",
    collapsed && "policy-panel--collapsed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={panelClass}>
      <button className="policy-panel__toggle" onClick={toggle}>
        Policy [P]
      </button>
      <div className="policy-panel__content">
        {currentPolicyInfo == null ? (
          <div className="policy-panel__oracle">Oracle Frame</div>
        ) : (
          <>
            <div className="policy-panel__entropy">
              H ={" "}
              <span className="policy-panel__entropy-value">
                {currentPolicyInfo.entropy.toFixed(2)}
              </span>
            </div>
            <div className="policy-panel__actions">
              {currentPolicyInfo.actions.map((entry, i) => {
                const isChosen =
                  JSON.stringify(entry.action) ===
                  JSON.stringify(currentPolicyInfo.chosen_action);
                const rowClass = [
                  "policy-panel__action",
                  isChosen && "policy-panel__action--chosen",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div key={i} className={rowClass}>
                    <div className="policy-panel__bar-container">
                      <div
                        className="policy-panel__bar"
                        style={{ width: `${entry.prob * 100}%` }}
                      />
                    </div>
                    <span className="policy-panel__prob">
                      {(entry.prob * 100).toFixed(1)}%
                    </span>
                    <span className="policy-panel__action-label">
                      {formatAction(entry.action)}
                    </span>
                    {isChosen && (
                      <span className="policy-panel__chosen-marker">
                        &#x2713;
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
