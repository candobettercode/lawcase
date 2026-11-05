import { Link, useNavigate } from "@tanstack/react-router";
import { Scale, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { resetDemo, setCurrentUser, useCurrentUser, useStore } from "@/lib/store";
import { toast } from "sonner";

const roleLabel = { admin: "Firm Admin", advocate: "Advocate", staff: "Staff", client: "Client" } as const;

export function AppHeader() {
  const s = useStore();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const links: { to: "/" | "/clients" | "/notifications" | "/admin" | "/book"; label: string; show: boolean }[] = [
    { to: "/", label: "Calendar", show: me.role !== "client" },
    { to: "/clients", label: "Clients", show: me.role !== "client" },
    { to: "/notifications", label: "Notifications", show: me.role !== "client" },
    { to: "/admin", label: "Firm settings", show: me.role === "admin" },
    { to: "/book", label: "Public booking", show: true },
  ];
  return (
    <header className="sticky top-0 z-30 border-b bg-primary text-primary-foreground">
      <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <Scale className="size-5 text-accent" />
          <span className="font-serif text-lg">{s.tenant.name}</span>
        </Link>
        <nav className="hidden gap-1 md:flex">
          {links.filter((l) => l.show).map((l) => (
            <Link key={l.to} to={l.to} className="rounded px-3 py-1.5 text-sm opacity-80 hover:opacity-100" activeOptions={{ exact: true }}
              activeProps={{ className: "bg-primary-foreground/10 opacity-100" }}>{l.label}</Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs uppercase tracking-wider opacity-60 lg:inline">Viewing as</span>
          <Select value={me.id} onValueChange={(v) => {
            setCurrentUser(v);
            const u = s.users.find((x) => x.id === v)!;
            navigate({ to: u.role === "client" ? "/book" : "/" });
          }}>
            <SelectTrigger className="h-8 w-[230px] border-primary-foreground/20 bg-primary-foreground/5 text-primary-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["admin", "advocate", "staff", "client"] as const).map((r) => (
                <SelectGroup key={r}>
                  <SelectLabel>{roleLabel[r]}</SelectLabel>
                  {s.users.filter((u) => u.role === r).map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button size="icon" variant="ghost" className="size-8 hover:bg-primary-foreground/10 hover:text-primary-foreground" title="Reset demo data"
            onClick={() => { resetDemo(); toast.success("Demo data reset"); }}><RotateCcw className="size-4" /></Button>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {links.filter((l) => l.show).map((l) => (
          <Link key={l.to} to={l.to} className="shrink-0 rounded px-3 py-1 text-sm opacity-80" activeOptions={{ exact: true }} activeProps={{ className: "bg-primary-foreground/10 opacity-100" }}>{l.label}</Link>
        ))}
      </nav>
    </header>
  );
}
