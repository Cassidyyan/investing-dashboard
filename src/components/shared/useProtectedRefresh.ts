"use client";
import { useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";

// Shared across page mounts in this tab; no financial data or session data stored.
const COOLDOWN_MS = 30_000;
let cooling = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const snapshot = () => cooling;
const serverSnapshot = () => false;
export function useProtectedRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const cooldown = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const refresh = () => {
    // Synchronous lock also blocks a second click before React renders disabled.
    if (cooling || pending) return;
    cooling = true;
    listeners.forEach((listener) => listener());
    setTimeout(() => {
      cooling = false;
      listeners.forEach((listener) => listener());
    }, COOLDOWN_MS);
    startTransition(() => router.refresh());
  };
  return { pending, refresh, cooldown };
}
