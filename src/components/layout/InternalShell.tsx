import type { ReactNode } from "react";
// The future authenticated layout owns this shell. It grants no access itself.
export function InternalShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-background">{header}<main className="page-gutter min-w-0 flex-1 py-6">{children}</main></div>;
}