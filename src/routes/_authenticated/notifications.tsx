import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/public-content";

export const Route = createFileRoute("/_authenticated/notifications")({ head: () => pageHead("Notifications", "Staff notifications.", true), component: Page });

function Page() {
  const q = useQuery({ queryKey: ["notifications"], refetchInterval: 15000, queryFn: async () => (await supabase.from("notifications").select("id,title,body,created_at,read_at").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  return <><div className="page-gutter py-8">
    <h1 className="mb-6 text-2xl">Notifications</h1>
    {!q.data?.length ? <p className="text-muted-foreground">No notifications yet.</p> :
      <ul className="max-w-3xl divide-y rounded-md border bg-card">{q.data.map((n) => <li key={n.id} className="p-4"><p className="font-medium">{n.title}</p><p className="text-sm text-muted-foreground">{n.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p></li>)}</ul>}
  </div></>;
}
