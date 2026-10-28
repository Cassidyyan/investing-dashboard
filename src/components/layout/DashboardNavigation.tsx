"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NavigationLink } from "./NavigationProgress";
import styles from "./DashboardNavigation.module.css";
import { navigationGroups } from "@/lib/navigation";

function NavIcon({ kind }: { kind: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "overview" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="3" width="7" height="7" rx="2" />
          <rect x="3" y="14" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
        </>
      ) : kind === "portfolio" ? (
        <>
          <rect x="3" y="7" width="18" height="14" rx="3" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a25 25 0 0 0 18 0M10 13h4" />
        </>
      ) : kind === "performance" ? (
        <>
          <path d="M3 4v16h18M6 15l5-5 4 3 6-8M16 5h5v5" />
        </>
      ) : (
        <>
          <path d="M4 5h16M4 12h10M4 19h13" />
          <circle cx="20" cy="12" r="1" />
        </>
      )}
    </svg>
  );
}

// Disclosure buttons use ordinary links inside: Tab/Shift+Tab works throughout.
export function DashboardNavigation({ path }: { path: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !nav.current?.contains(event.target))
        setOpen(null);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <nav
      ref={nav}
      className={styles.nav}
      aria-label="Portfolio pages"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          nav.current
            ?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')
            ?.focus();
          setOpen(null);
        }
      }}
    >
      <NavigationLink
        href="/"
        className={`${styles.control} ${path === "/" ? styles.active : ""}`}
        aria-current={path === "/" ? "page" : undefined}
        onClick={() => setOpen(null)}
      >
        <NavIcon kind="overview" />
        Overview
      </NavigationLink>
      {navigationGroups.map((group) => {
        const current = group.links.find((link) => link.href === path);
        const expanded = open === group.id;
        const panelId = `${id}-${group.id}`;
        return (
          <div className={styles.group} key={group.id}>
            <button
              className={`${styles.control} ${current ? styles.active : ""}`}
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              aria-label={
                current ? `${group.label}: ${current.label}` : group.label
              }
              onClick={() => setOpen(expanded ? null : group.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpen(group.id);
                  requestAnimationFrame(() =>
                    document
                      .getElementById(panelId)
                      ?.querySelector<HTMLAnchorElement>(
                        'a[aria-current="page"], a',
                      )
                      ?.focus(),
                  );
                }
              }}
            >
              <NavIcon kind={group.id} />
              {group.label}
              <svg
                className={`${styles.chevron} ${expanded ? styles.rotated : ""}`}
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" />
              </svg>
            </button>
            <div id={panelId} className={styles.dropdown} hidden={!expanded}>
              <span className={styles.caption}>{group.label}</span>
              {group.links.map((link) => (
                <NavigationLink
                  key={link.href}
                  href={link.href}
                  className={styles.destination}
                  aria-current={path === link.href ? "page" : undefined}
                  onClick={() => setOpen(null)}
                >
                  <span>
                    <strong>{link.label}</strong>
                    <small>{link.detail}</small>
                  </span>
                  {path === link.href && (
                    <span className={styles.dot} aria-hidden="true" />
                  )}
                </NavigationLink>
              ))}
            </div>
          </div>
        );
      })}
      <NavigationLink
        href="/activity"
        className={`${styles.control} ${path === "/activity" ? styles.active : ""}`}
        aria-current={path === "/activity" ? "page" : undefined}
        onClick={() => setOpen(null)}
      >
        <NavIcon kind="activity" />
        Activity
      </NavigationLink>
    </nav>
  );
}
