import { NavigationLink } from "@/components/layout/NavigationProgress";
import { navigationGroups } from "@/lib/navigation";
import styles from "./PortfolioLinks.module.css";
export function PortfolioLinks({ path }: { path: string }) {
  return (
    <nav className={styles.links} aria-label="Portfolio sections">
      {navigationGroups[0].links.map((link) => (
        <NavigationLink
          key={link.href}
          href={link.href}
          aria-current={path === link.href ? "page" : undefined}
        >
          {link.label}
        </NavigationLink>
      ))}
    </nav>
  );
}
