"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { StonkLoader } from "@/components/layout/StonkLoader";

type Progress = {
  begin: (path: string) => void;
  complete: (path: string) => void;
  cancel: () => void;
};
const NavigationContext = createContext<Progress>({
  begin: () => {},
  complete: () => {},
  cancel: () => {},
});

export function NavigationProgress({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<"loading" | "crash" | null>(null);
  const target = useRef<string | null>(null);
  const startedAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  const cancel = useCallback(() => {
    clearTimers();
    target.current = null;
    setPhase(null);
  }, [clearTimers]);
  useEffect(() => {
    window.addEventListener("popstate", cancel);
    return () => window.removeEventListener("popstate", cancel);
  }, [cancel]);
  const begin = useCallback(
    (path: string) => {
      clearTimers();
      target.current = path;
      startedAt.current = Date.now();
      setPhase("loading");
    },
    [clearTimers],
  );
  const complete = useCallback(
    (path: string) => {
      if (target.current !== path) return;
      clearTimers();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        target.current = null;
        setPhase(null);
        return;
      }
      // Briefly finish the illustration without delaying the page's data or render.
      timers.current.push(
        setTimeout(
          () => {
            setPhase("crash");
            timers.current.push(
              setTimeout(() => {
                target.current = null;
                setPhase(null);
              }, 650),
            );
          },
          Math.max(0, 500 - (Date.now() - startedAt.current)),
        ),
      );
    },
    [clearTimers],
  );
  return (
    <NavigationContext.Provider value={{ begin, complete, cancel }}>
      {children}
      {phase && (
        <div
          className="stonk-overlay"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <StonkLoader phase={phase} />
        </div>
      )}
    </NavigationContext.Provider>
  );
}

// Keep Next.js link behavior (including modifier keys), starting only real navigation.
export function NavigationLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "href" | "onNavigate"> & {
  href: string;
}) {
  const { begin, cancel } = useContext(NavigationContext);
  const pathname = usePathname();
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onNavigate={() => {
        if (href !== pathname) begin(href);
        else cancel();
      }}
    />
  );
}

// Mount only with the finished page, not its loading fallback. Errors also mount
// this marker so a failed request cannot leave the navigation overlay stuck.
export function NavigationReady({ path }: { path?: string }) {
  const pathname = usePathname();
  const { complete } = useContext(NavigationContext);
  useEffect(() => {
    complete(path ?? pathname);
  }, [complete, path, pathname]);
  return null;
}
