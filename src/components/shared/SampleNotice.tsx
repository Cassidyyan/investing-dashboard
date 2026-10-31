"use client";
import { useAppSettings } from "./AppSettings";
import { NavigationLink } from "@/components/layout/NavigationProgress";
import styles from "@/styles/dashboard.module.css";
export function SampleNotice({ href }: { href: string }) {
  if (useAppSettings().demo) return null;
  return (
    <div className={styles.previewBanner} role="status">
      <span>Sample data</span>
      <span className={styles.srOnly}>
        Development preview. All figures are invented sample data.
      </span>
      <NavigationLink href={href}>Return to live</NavigationLink>
    </div>
  );
}
