// Shared destinations keep the navigation and overview shortcuts consistent.
export const navigationGroups = [
  {
    id: "portfolio",
    label: "Portfolio",
    links: [
      {
        href: "/accounts",
        label: "Investing accounts",
        detail: "Balances and buying power",
      },
      {
        href: "/cash",
        label: "Cash & chequing",
        detail: "Your banking and cash accounts",
      },
      {
        href: "/holdings",
        label: "Holdings & options",
        detail: "Positions and allocation",
      },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    links: [
      {
        href: "/performance",
        label: "Account performance",
        detail: "Portfolio value over time",
      },
      {
        href: "/returns",
        label: "Holding returns",
        detail: "Sales, gains, and dividends",
      },
    ],
  },
] as const;
