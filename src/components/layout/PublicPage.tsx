import type { ReactNode } from "react";
export function PublicPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="page-gutter py-10 sm:py-12">
    <div className="mb-10 border-b pb-8"><p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p><h1 className="text-3xl leading-normal sm:text-4xl">{title}</h1><p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{description}</p></div>
    {children}
  </div>;
}