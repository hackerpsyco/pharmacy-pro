import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, BellOff } from "lucide-react";
import { toast } from "sonner";

type N = { id: string; type: string; title: string; message: string | null; read: boolean; created_at: string };

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — MediShop" }] }),
  component: NotifPage,
});

function NotifPage() {
  const [items, setItems] = useState<N[]>([]);
  const load = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    setItems((data as N[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => { await supabase.from("notifications").update({ read: true }).eq("id", id); load(); };
  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    toast.success("All marked read"); load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Notifications" description="Stock and sales alerts"
        actions={<Button variant="outline" onClick={markAll}><Check className="h-4 w-4 mr-1" />Mark all read</Button>} />
      <Card><CardContent className="p-0 divide-y">
        {items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
            <BellOff className="h-8 w-8" /> No notifications yet
          </div>
        ) : items.map((n) => (
          <div key={n.id} className={`p-4 flex items-start justify-between gap-3 ${n.read ? "opacity-60" : ""}`}>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{n.type}</div>
              <div className="font-medium">{n.title}</div>
              {n.message && <div className="text-sm text-muted-foreground">{n.message}</div>}
              <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
            </div>
            {!n.read && <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>Mark read</Button>}
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
