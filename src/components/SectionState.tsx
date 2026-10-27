import type { ReactNode } from "react";
import type { Result } from "@/lib/types";
export function SectionState<T>({
  result,
  empty,
  children,
}: {
  result: Result<T>;
  empty?: boolean;
  children: (data: T) => ReactNode;
}) {
  if (result.status === "error")
    return (
      <p className="notice" role="status">
        {result.message}
      </p>
    );
  if (empty) return <p className="empty">No records available.</p>;
  return <>{children(result.data)}</>;
}
export function StateNotice({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="status">
      {children}
    </p>
  );
}
