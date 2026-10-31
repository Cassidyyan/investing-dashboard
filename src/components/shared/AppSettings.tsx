"use client";
import { createContext, useContext } from "react";
import type { PublicSettings } from "@/lib/config";
// Isolated previews retain their existing explicit USD policy. Live layouts
// always supply validated installation settings, whose default is reported.
type SettingsValue = PublicSettings & { setupErrors?: string[] };
const Settings = createContext<SettingsValue>({
  demo: false,
  optionsCurrency: "USD",
  cashOnlyAsHysa: false,
});
export function AppSettingsProvider({
  settings,
  children,
}: {
  settings: SettingsValue;
  children: React.ReactNode;
}) {
  return <Settings.Provider value={settings}>{children}</Settings.Provider>;
}
export function useAppSettings() {
  return useContext(Settings);
}
