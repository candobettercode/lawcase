import { Link } from "@tanstack/react-router";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { CompactFirmBrand } from "@/components/branding/FirmBrand";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { firmName } from "@/lib/public-content";

const links = [
  { to: "/", label: "Book Appointment" },
  { to: "/how-it-works", label: "How It Works" },
  { to: "/advocates", label: "Our Advocates" },
  { to: "/locations", label: "Locations" },
  { to: "/contact", label: "Contact" },
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);
  return <header className="border-b border-header-border bg-header text-header-foreground">
    <div className="page-gutter grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 xl:grid-cols-[minmax(240px,1fr)_auto_minmax(120px,1fr)]">
      <Link to="/" onClick={() => setOpen(false)} className="flex min-w-0 items-center gap-3" aria-label={firmName}>
        <CompactFirmBrand />
      </Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-6 xl:flex">
        {links.map(l => <Link key={l.to} to={l.to} activeOptions={{ exact: true }} className="flex min-h-11 items-center border-b-2 border-transparent text-sm text-header-muted transition-colors hover:text-header-foreground" activeProps={{ className: "border-brand text-header-foreground" }}>{l.label}</Link>)}
      </nav>
      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost" className="hidden h-11 text-header-foreground hover:bg-header-hover hover:text-header-foreground sm:inline-flex"><Link to="/auth">Login <ArrowUpRight /></Link></Button>
        <Button size="icon" variant="ghost" className="size-11 hover:bg-header-hover hover:text-header-foreground xl:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</Button>
      </div>
    </div>
    {open && <nav id="mobile-navigation" aria-label="Mobile navigation" className="page-gutter grid border-t border-header-border py-3 xl:hidden">
      {links.map(l => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="flex min-h-11 items-center text-sm text-header-muted" activeOptions={{ exact: true }} activeProps={{ className: "text-brand" }}>{l.label}</Link>)}
      <Link to="/auth" onClick={() => setOpen(false)} className="flex min-h-11 items-center text-sm">Login <ArrowUpRight className="ml-2 size-4" /></Link>
    </nav>}
  </header>;
}