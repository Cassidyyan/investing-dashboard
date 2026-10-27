"use client";

// Both panels are rendered by the server. Switching tabs only changes visibility.
import { useId, useRef, useState, type ReactNode } from "react";
export function PositionsTabs({
  holdings,
  optionPositions,
}: {
  holdings: ReactNode;
  optionPositions: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const id = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const labels = ["Current holdings", "Current options"];
  return (
    <section className="panel" id="positions">
      <h2>Your positions</h2>
      <div className="position-tabs" role="tablist" aria-label="Position type">
        {labels.map((label, index) => (
          <button
            key={label}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={active === index}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              let target = index;
              if (event.key === "ArrowRight" || event.key === "ArrowLeft")
                target = 1 - index;
              else if (event.key === "Home") target = 0;
              else if (event.key === "End") target = 1;
              else return;
              event.preventDefault();
              setActive(target);
              buttons.current[target]?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="muted">
        Holdings exclude options. The options tab includes option and
        futures-option positions. Values use reported prices and multipliers
        when supported.
      </p>
      {[holdings, optionPositions].map((panel, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={active !== index}
          tabIndex={0}
        >
          {panel}
        </div>
      ))}
    </section>
  );
}
