import { NavigationLink } from "@/components/layout/NavigationProgress";
import { navigationGroups } from "@/lib/navigation";
import styles from "./PortfolioLinks.module.css";
export function PortfolioLinks({
  path,
  group = "portfolio",
}: {
  path: string;
  group?: "portfolio" | "performance";
}) {
  const section = navigationGroups.find((item) => item.id === group)!;
  return (
    <nav className={styles.links} aria-label={`${section.label} sections`}>
      {section.links.map((link) => (
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
