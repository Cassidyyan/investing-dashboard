"use client";

import {
  createContext,
  useContext,
  useState,
  isValidElement,
  type ReactNode,
} from "react";
const BalancePrivacy = createContext({ hidden: false, toggle: () => {} });
export function useBalancePrivacy() {
  return useContext(BalancePrivacy);
}
export function BalancePrivacyProvider({
  children,
  initialHidden = false,
}: {
  children: ReactNode;
  initialHidden?: boolean;
}) {
  const [hidden, setHidden] = useState(initialHidden);
  function toggle() {
    const next = !hidden;
    setHidden(next);
    // Store only a display preference, never financial information.
    document.cookie = `balances-hidden=${next ? "1" : "0"}; Path=/; Max-Age=31536000; SameSite=Strict${window.location.protocol === "https:" ? "; Secure" : ""}`;
  }
  return (
    <BalancePrivacy.Provider value={{ hidden, toggle }}>
      {children}
    </BalancePrivacy.Provider>
  );
}
export function BalanceVisibilityToggle({
  className = "balance-visibility-toggle",
}: {
  className?: string;
}) {
  const { hidden, toggle } = useContext(BalancePrivacy);
  return (
    <button
      className={className}
      type="button"
      aria-pressed={hidden}
      onClick={toggle}
      aria-label={hidden ? "Show balances" : "Hide balances"}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {hidden && <path d="m3 3 18 18" />}
      </svg>
      <span>{hidden ? "Show balances" : "Hide balances"}</span>
    </button>
  );
}
export function PrivateValue({
  children,
  placeholder = "••••••",
}: {
  children: ReactNode;
  placeholder?: string;
}) {
  const { hidden } = useContext(BalancePrivacy);
  function text(node: ReactNode): string {
    if (typeof node === "string" || typeof node === "number")
      return String(node);
    if (Array.isArray(node)) return node.map(text).join("");
    if (isValidElement<{ children?: ReactNode }>(node))
      return text(node.props.children);
    return "";
  }
  const width = Math.max(6, text(children).length);
  return (
    <span
      style={{ inlineSize: `${width}ch`, blockSize: "1lh" }}
      className={`private-value${hidden ? " private-value-hidden" : ""}`}
      aria-label={hidden ? "Amount hidden" : undefined}
    >
      {hidden ? <span className="private-mask">{placeholder}</span> : children}
    </span>
  );
}
