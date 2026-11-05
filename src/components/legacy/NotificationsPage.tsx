import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, ShieldCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";



export function NotificationsPage() {
  const s = useStore();
  const [sel, setSel] = useState<string | null>(null);
  const n = s.notifications.find((x) => x.id === sel) ?? s.notifications[0];
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-5">
      <h1 className="mb-1 text-2xl">Notifications</h1>
      <p className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="size-4" /> Client emails never include matter, opposing party, intake or service details.</p>
      <Tabs defaultValue="emails">
        <TabsList><TabsTrigger value="emails">Email log ({s.notifications.length})</TabsTrigger><TabsTrigger value="audit">Audit log ({s.audit.length})</TabsTrigger></TabsList>
        <TabsContent value="emails">
          {!s.notifications.length ? <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">No emails yet. Book, reschedule or confirm an appointment to see previews here.</p> : (
            <div className="grid gap-4 md:grid-cols-[360px_1fr]">
              <div className="divide-y overflow-hidden rounded-lg border bg-card">
                {s.notifications.map((x) => (
                  <button key={x.id} onClick={() => setSel(x.id)} className={cn("block w-full px-3 py-2.5 text-left hover:bg-muted/50", n?.id === x.id && "bg-secondary")}>
                    <div className="flex justify-between text-xs text-muted-foreground"><span className="capitalize">{x.kind}</span><span>{new Date(x.createdAt).toLocaleString()}</span></div>
                    <div className="truncate text-sm font-medium">{x.subject}</div>
                    <div className="truncate text-xs text-muted-foreground">To: {x.to}</div>
                  </button>
                ))}
              </div>
              {n && (
                <div className="rounded-lg border bg-card">
                  <div className="border-b p-4 text-sm"><p className="flex items-center gap-2 font-medium"><Mail className="size-4" />{n.subject}</p><p className="text-muted-foreground">From: notifications@apexlegal.com · To: {n.to}</p></div>
                  <pre className="whitespace-pre-wrap p-5 font-sans text-sm leading-relaxed">{n.body}</pre>
                </div>
              )}
            </div>
          )}
        </TabsContent>
        <TabsContent value="audit">
          <div className="divide-y rounded-lg border bg-card text-sm">
            {s.audit.map((a) => <div key={a.id} className="flex gap-4 px-3 py-2"><span className="w-44 shrink-0 text-muted-foreground">{new Date(a.at).toLocaleString()}</span><span className="w-32 shrink-0 font-medium">{a.actor}</span><span>{a.action}</span></div>)}
            {!s.audit.length && <p className="p-8 text-center text-muted-foreground">No activity recorded yet.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
