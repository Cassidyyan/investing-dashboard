import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
const config = [
  ...next,
  ...ts,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name=/^NEXT_PUBLIC_SNAPTRADE/i]",
          message: "SnapTrade credentials must remain server-only.",
        },
        {
          selector: "Literal[value=/NEXT_PUBLIC_SNAPTRADE/i]",
          message: "SnapTrade credentials must remain server-only.",
        },
        {
          selector:
            "MemberExpression[property.name=/^(trading|options|registerSnapTradeUser|place.*Order|submit.*Order|cancel.*Order|replace.*Order|modify.*Order|execute.*Order|preview.*Order)$/i]",
          message:
            "Trading and user registration are forbidden in this read-only app.",
        },
        {
          selector:
            "MemberExpression[property.value=/^(trading|options|registerSnapTradeUser|place.*Order|submit.*Order|cancel.*Order|replace.*Order|modify.*Order|execute.*Order|preview.*Order)$/i]",
          message:
            "Trading and user registration are forbidden in this read-only app.",
        },
      ],
    },
  },
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "snaptrade-typescript-sdk",
              message: "Use the server-only portfolio loader.",
            },
          ],
        },
      ],
    },
  },
];

export default config;
