import "server-only";
import { parseConfig } from "@/lib/config";
export function getConfig() {
  return parseConfig(process.env);
}
export function selectedPreview(requested?: string) {
  return getConfig().settings.demo ? "sample" : requested;
}
export function previewsEnabled() {
  return process.env.NODE_ENV === "development" || getConfig().settings.demo;
}
