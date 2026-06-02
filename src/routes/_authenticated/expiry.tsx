import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/StatusPill";
import { expiryStatus, type Medicine } from "@/lib/pharmacy";

export const Route = createFileRoute("/_authenticated/expiry")({
  head: () => ({ meta: [{ title: "Expiry — MediShop" }] }),
  component: ExpiryPage,
});

function ExpiryPage() {
  const [meds, setMeds] = useState<Medicine[]>([]);
  useEffect(() => {
    supabase.from("medicines").select("*").not("expiry_date", "is", null).order("expiry_date")
      .then(({ data }) => setMeds((data as Medicine[]) ?? []));
  }, []);

  const buckets = useMemo(() => {
    const expired: Medicine[] = [], d7: Medicine[] = [], d30: Medicine[] = [], d60: Medicine[] = [], safe: Medicine[] = [];
    meds.forEach((m) => {
      const e = expiryStatus(m.expiry_date);
      if (e.days === null) return;
      if (e.days < 0) expired.push(m);
      else if (e.days <= 7) d7.push(m);
      else if (e.days <= 30) d30.push(m);
      else if (e.days <= 60) d60.push(m);
      else safe.push(m);
    });
    return { expired, d7, d30, d60, safe };
  }, [meds]);

  const renderTable = (rows: Medicine[]) => (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nothing here</TableCell></TableRow> :
            rows.map((m) => {
              const e = expiryStatus(m.expiry_date);
              return (<TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-xs">{m.batch_number || "—"}</TableCell>
                <TableCell className="text-xs">{m.expiry_date}</TableCell>
                <TableCell className="text-right">{m.quantity}</TableCell>
                <TableCell><StatusPill tone={e.tone}>{e.label}</StatusPill></TableCell>
              </TableRow>);
            })}
        </TableBody>
      </Table>
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Expiry Tracker" description="Track medicines by expiry window" />
      <Tabs defaultValue="d30">
        <TabsList className="grid grid-cols-5 max-w-2xl">
          <TabsTrigger value="expired">Expired ({buckets.expired.length})</TabsTrigger>
          <TabsTrigger value="d7">7 days ({buckets.d7.length})</TabsTrigger>
          <TabsTrigger value="d30">30 days ({buckets.d30.length})</TabsTrigger>
          <TabsTrigger value="d60">60 days ({buckets.d60.length})</TabsTrigger>
          <TabsTrigger value="safe">Safe ({buckets.safe.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="expired" className="mt-3">{renderTable(buckets.expired)}</TabsContent>
        <TabsContent value="d7" className="mt-3">{renderTable(buckets.d7)}</TabsContent>
        <TabsContent value="d30" className="mt-3">{renderTable(buckets.d30)}</TabsContent>
        <TabsContent value="d60" className="mt-3">{renderTable(buckets.d60)}</TabsContent>
        <TabsContent value="safe" className="mt-3">{renderTable(buckets.safe)}</TabsContent>
      </Tabs>
    </div>
  );
}
