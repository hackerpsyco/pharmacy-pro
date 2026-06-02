import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, FileText } from "lucide-react";
import { adjustStock, fmtMoney, generateInvoiceNumber, type Medicine } from "@/lib/pharmacy";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({ meta: [{ title: "Purchases — MediShop" }] }),
  component: PurchasesPage,
});

type Supplier = { id: string; name: string };
type Line = { medicine_id: string; medicine_name: string; quantity: number; cost_price: number; gst: number };

function PurchasesPage() {
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [sups, setSups] = useState<Supplier[]>([]);
  const [history, setHistory] = useState<{ id: string; invoice_number: string | null; total_amount: number; purchase_date: string; suppliers: { name: string } | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([]);

  const load = async () => {
    const [m, s, h] = await Promise.all([
      supabase.from("medicines").select("*").order("name"),
      supabase.from("suppliers").select("id,name").order("name"),
      supabase.from("purchases").select("id,invoice_number,total_amount,purchase_date,suppliers(name)").order("purchase_date", { ascending: false }).limit(50),
    ]);
    setMeds((m.data as Medicine[]) ?? []);
    setSups((s.data as Supplier[]) ?? []);
    setHistory((h.data as never) ?? []);
  };
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    let sub = 0, gst = 0;
    lines.forEach((l) => { sub += l.cost_price * l.quantity; gst += l.cost_price * l.quantity * (l.gst / 100); });
    return { sub, gst, total: sub + gst };
  }, [lines]);

  const addLine = () => setLines((l) => [...l, { medicine_id: "", medicine_name: "", quantity: 1, cost_price: 0, gst: 0 }]);
  const setLine = (i: number, l: Partial<Line>) => setLines((s) => s.map((x, idx) => idx === i ? { ...x, ...l } : x));
  const onMedicine = (i: number, id: string) => {
    const m = meds.find((x) => x.id === id);
    if (m) setLine(i, { medicine_id: id, medicine_name: m.name, cost_price: m.cost_price, gst: m.gst });
  };

  const save = async () => {
    if (lines.length === 0 || lines.some((l) => !l.medicine_id)) return toast.error("Add at least one valid line");
    const inv = invoice || generateInvoiceNumber("PUR");
    const { data: pur, error } = await supabase.from("purchases").insert({
      invoice_number: inv, supplier_id: supplierId || null, purchase_date: date,
      total_amount: totals.total, gst_amount: totals.gst,
    }).select().single();
    if (error || !pur) return toast.error(error?.message ?? "Failed");
    const items = lines.map((l) => ({
      purchase_id: pur.id, medicine_id: l.medicine_id, quantity: l.quantity, cost_price: l.cost_price,
      gst: l.gst, subtotal: l.cost_price * l.quantity * (1 + l.gst / 100),
    }));
    await supabase.from("purchase_items").insert(items);
    for (const l of lines) await adjustStock(l.medicine_id, l.quantity, "purchase", pur.id);
    await supabase.from("notifications").insert({ type: "purchase", title: "Purchase recorded", message: `${inv} — ${fmtMoney(totals.total)}` });
    toast.success("Purchase saved & stock updated");
    setOpen(false); setLines([]); setInvoice(""); setSupplierId("");
    load();
  };

  const downloadPdf = (id: string) => {
    const p = history.find((x) => x.id === id); if (!p) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("MediShop — Purchase Invoice", 14, 18);
    doc.setFontSize(10);
    doc.text(`Invoice: ${p.invoice_number ?? id}`, 14, 26);
    doc.text(`Date: ${p.purchase_date}`, 14, 32);
    doc.text(`Supplier: ${p.suppliers?.name ?? "—"}`, 14, 38);
    autoTable(doc, { startY: 44, head: [["Total Amount"]], body: [[fmtMoney(p.total_amount)]] });
    doc.save(`${p.invoice_number ?? id}.pdf`);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Purchases" description="Record stock-in from suppliers"
        actions={<Button onClick={() => { setLines([{ medicine_id: "", medicine_name: "", quantity: 1, cost_price: 0, gst: 0 }]); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />New Purchase</Button>} />
      <Card><CardHeader><CardTitle>Recent Purchases</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {history.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No purchases yet</TableCell></TableRow> :
                history.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.invoice_number ?? "—"}</TableCell>
                    <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                    <TableCell>{p.purchase_date}</TableCell>
                    <TableCell className="text-right">{fmtMoney(p.total_amount)}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => downloadPdf(p.id)}><FileText className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Purchase</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{sups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Invoice #</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="auto" /></div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="border rounded-md mt-2">
            <Table>
              <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="w-24">Qty</TableHead><TableHead className="w-28">Cost</TableHead><TableHead className="w-20">GST%</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {lines.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={l.medicine_id} onValueChange={(v) => onMedicine(i, v)}>
                        <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                        <SelectContent>{meds.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={l.cost_price} onChange={(e) => setLine(i, { cost_price: Number(e.target.value) })} /></TableCell>
                    <TableCell><Input type="number" step="0.01" value={l.gst} onChange={(e) => setLine(i, { gst: Number(e.target.value) })} /></TableCell>
                    <TableCell className="text-right">{fmtMoney(l.cost_price * l.quantity * (1 + l.gst / 100))}</TableCell>
                    <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => setLines((s) => s.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-between items-center mt-2">
            <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-1" />Add line</Button>
            <div className="text-right text-sm">
              <div>Subtotal: <span className="font-medium">{fmtMoney(totals.sub)}</span></div>
              <div>GST: <span className="font-medium">{fmtMoney(totals.gst)}</span></div>
              <div className="text-lg font-semibold">Total: {fmtMoney(totals.total)}</div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save Purchase</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
