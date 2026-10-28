"use client";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./InfoPopover.module.css";
export function InfoPopover({
  label,
  children,
  trigger = "i",
  align = "end",
  badge = false,
}: {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
  align?: "start" | "end";
  badge?: boolean;
}) {
  const node = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function close(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        node.current &&
        !node.current.contains(event.target)
      )
        node.current.open = false;
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details
      ref={node}
      className={`${styles.popover} ${align === "start" ? styles.start : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && node.current?.open) {
          event.preventDefault();
          node.current.open = false;
          node.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label={label} className={badge ? styles.badge : ""}>
        {trigger}
      </summary>
      <div className={styles.panel} role="note" tabIndex={0}>
        {children}
      </div>
    </details>
  );
}
