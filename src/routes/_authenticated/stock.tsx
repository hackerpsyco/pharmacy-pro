import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/StatusPill";
import { stockStatus, fmtMoney, type Medicine } from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({ meta: [{ title: "Stock — MediShop" }] }),
  component: StockPage,
});

type Movement = { id: string; change: number; reason: string; created_at: string; medicines: { name: string } | null };

function StockPage() {
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  useEffect(() => {
    (async () => {
      const [m, mv] = await Promise.all([
        supabase.from("medicines").select("*").order("quantity"),
        supabase.from("stock_movements").select("id,change,reason,created_at,medicines(name)").order("created_at", { ascending: false }).limit(50),
      ]);
      setMeds((m.data as Medicine[]) ?? []);
      setMovements((mv.data as never) ?? []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Stock" description="Live stock status and movement history" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Stock Status</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {meds.map((m) => {
                  const st = stockStatus(m);
                  return (
                    <TableRow key={m.id}>
                      <TableCell><div className="font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{fmtMoney(m.selling_price)}</div></TableCell>
                      <TableCell className="text-xs">{m.batch_number || "—"}</TableCell>
                      <TableCell className="text-right">{m.quantity}</TableCell>
                      <TableCell><StatusPill tone={st.tone}>{st.label}</StatusPill></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Movement History</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Medicine</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{m.medicines?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize text-xs">{m.reason}</TableCell>
                    <TableCell className={`text-right font-medium ${m.change > 0 ? "text-success" : "text-destructive"}`}>{m.change > 0 ? "+" : ""}{m.change}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
