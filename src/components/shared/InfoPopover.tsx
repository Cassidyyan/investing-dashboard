"use client";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./InfoPopover.module.css";
function positionPanel(node: HTMLDetailsElement | null) {
  if (!node?.open) return;
  const panel = node.querySelector<HTMLDivElement>('[role="note"]');
  if (!panel) return;
  panel.style.transform = "";
  const rect = panel.getBoundingClientRect();
  const edge = document.documentElement.clientWidth - 12;
  const shift =
    rect.left < 12 ? 12 - rect.left : rect.right > edge ? edge - rect.right : 0;
  panel.style.transform = shift ? `translateX(${shift}px)` : "";
}
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
    const reposition = () => positionPanel(node.current);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", reposition);
    };
  }, []);
  return (
    <details
      ref={node}
      onToggle={() => positionPanel(node.current)}
      className={`${styles.popover} ${align === "start" ? styles.start : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && node.current?.open) {
          event.preventDefault();
          node.current.open = false;
          node.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary
        aria-label={
          typeof trigger === "string" && trigger !== "i" && trigger !== "•"
            ? `${trigger}: ${label}`
            : label
        }
        className={
          trigger === "•"
            ? `${styles.icon} ${styles.warning}`
            : trigger === "i"
              ? styles.icon
              : badge
                ? styles.badge
                : ""
        }
      >
        {trigger === "i" || trigger === "•" ? (
          <span aria-hidden="true">{trigger}</span>
        ) : (
          trigger
        )}
      </summary>
      <div className={styles.panel} role="note" tabIndex={0}>
        {children}
      </div>
    </details>
  );
}
