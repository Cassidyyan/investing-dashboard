import type { Metadata } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { BalancePrivacyProvider } from "@/components/shared/BalancePrivacy";
import "./globals.css";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
// Font files are bundled locally; rendering never contacts Google Fonts.
const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-standard-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
const editorial = localFont({
  src: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2",
  variable: "--font-cormorant",
  weight: "300 700",
  display: "swap",
});
const labels = localFont({
  src: "../../node_modules/@fontsource-variable/league-spartan/files/league-spartan-latin-wght-normal.woff2",
  variable: "--font-spartan",
  weight: "100 900",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Holdings · Private investing dashboard",
  description: "Your private, read-only portfolio overview.",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const hidden = (await cookies()).get("balances-hidden")?.value === "1";
  return (
    <html
      lang="en"
      className={`${inter.variable} ${editorial.variable} ${labels.variable}`}
    >
      <body>
        <BalancePrivacyProvider initialHidden={hidden}>
          <NavigationProgress>{children}</NavigationProgress>
        </BalancePrivacyProvider>
      </body>
    </html>
  );
}
