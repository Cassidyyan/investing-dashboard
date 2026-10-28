// App-maintained business groups, reviewed 2026-10-26 against issuer descriptions.
// These are simplified categories, not licensed GICS or ETF look-through data.
// Exact listing symbols are intentional: do not strip exchange suffixes.
type Classification = {
  industry: string;
  source: string;
  kind: "company" | "fund";
};
export const securityIndustries: Readonly<Record<string, Classification>> = {
  BAM: {
    industry: "Asset management",
    source: "https://bam.brookfield.com/",
    kind: "company",
  },
  "BAM.TO": {
    industry: "Asset management",
    source: "https://bam.brookfield.com/",
    kind: "company",
  },
  SOFI: {
    industry: "Digital banking & lending",
    source: "https://www.sofi.com/our-company/",
    kind: "company",
  },
  "ZVST.NE": {
    industry: "Electric power",
    source: "https://vistracorp.com/about/",
    kind: "company",
  },
  AMZN: {
    industry: "E-commerce & cloud services",
    source: "https://www.aboutamazon.com/what-we-do",
    kind: "company",
  },
  AVGO: {
    industry: "Semiconductors",
    source: "https://www.broadcom.com/company/about-us",
    kind: "company",
  },
  CRDO: {
    industry: "Semiconductors",
    source: "https://credosemi.com/about-credo/",
    kind: "company",
  },
  NVDA: {
    industry: "Semiconductors",
    source: "https://www.nvidia.com/en-us/about-nvidia/",
    kind: "company",
  },
  TSM: {
    industry: "Semiconductors",
    source: "https://www.tsmc.com/english/aboutTSMC",
    kind: "company",
  },
  GOOG: {
    industry: "Internet & digital advertising",
    source: "https://abc.xyz/",
    kind: "company",
  },
  GOOGL: {
    industry: "Internet & digital advertising",
    source: "https://abc.xyz/",
    kind: "company",
  },
  META: {
    industry: "Internet & digital advertising",
    source: "https://about.meta.com/",
    kind: "company",
  },
  NFLX: {
    industry: "Entertainment & streaming",
    source: "https://about.netflix.com/en",
    kind: "company",
  },
  TSLA: {
    industry: "Automobiles & energy",
    source: "https://www.tesla.com/about",
    kind: "company",
  },
  UBER: {
    industry: "Transportation platforms",
    source: "https://www.uber.com/us/en/about/",
    kind: "company",
  },
  CRWD: {
    industry: "Cybersecurity software",
    source: "https://www.crowdstrike.com/en-us/about-us/",
    kind: "company",
  },
  "VFV.TO": {
    industry: "Diversified equity funds",
    source:
      "https://www.vanguard.ca/en/product/etf/equity/9563/vanguard-sp-500-index-etf",
    kind: "fund",
  },
  "XEQT.TO": {
    industry: "Diversified equity funds",
    source:
      "https://www.blackrock.com/ca/investors/en/products/309480/ishares-core-equity-etf-portfolio",
    kind: "fund",
  },
  SCHD: {
    industry: "Diversified equity funds",
    source: "https://www.schwabassetmanagement.com/products/schd",
    kind: "fund",
  },
  URA: {
    industry: "Sector funds (no look-through)",
    source: "https://www.globalxetfs.com/funds/ura/",
    kind: "fund",
  },
  SLV: {
    industry: "Precious-metals trusts",
    source:
      "https://www.ishares.com/us/products/239855/ishares-silver-trust-fund",
    kind: "fund",
  },
  "PHYS.TO": {
    industry: "Precious-metals trusts",
    source:
      "https://sprott.com/investment-strategies/exchange-listed-products/physical-bullion-funds/gold/",
    kind: "fund",
  },
};
export function securityIndustry(symbol: string, kind: string): Classification {
  const entry = Object.hasOwn(securityIndustries, symbol)
    ? securityIndustries[symbol]
    : undefined;
  const fund = ["etf", "cef", "mutualfund"].includes(kind);
  if (entry && (entry.kind === "fund" || !fund)) return entry;
  return {
    industry: fund ? "Funds — unclassified" : "Unclassified",
    source: "",
    kind: fund ? "fund" : "company",
  };
}
