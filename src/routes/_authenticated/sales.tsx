import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Search, Printer } from "lucide-react";
import { adjustStock, fmtMoney, generateInvoiceNumber, type Medicine } from "@/lib/pharmacy";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "POS / Sales — MediShop" }] }),
  component: SalesPage,
});

type CartItem = { medicine: Medicine; qty: number };

function SalesPage() {
  const [meds, setMeds] = useState<Medicine[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [discount, setDiscount] = useState(0);
  const [recent, setRecent] = useState<{ id: string; invoice_number: string; total: number; sale_date: string }[]>([]);

  const load = async () => {
    const [m, r] = await Promise.all([
      supabase.from("medicines").select("*").gt("quantity", 0).order("name"),
      supabase.from("sales").select("id,invoice_number,total,sale_date").order("sale_date", { ascending: false }).limit(10),
    ]);
    setMeds((m.data as Medicine[]) ?? []);
    setRecent(r.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const matches = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return meds.filter((m) =>
      m.name.toLowerCase().includes(q) || (m.code ?? "").toLowerCase().includes(q) || (m.generic_name ?? "").toLowerCase().includes(q)
    ).slice(0, 8);
  }, [search, meds]);

  const addToCart = (m: Medicine) => {
    setCart((c) => {
      const i = c.findIndex((x) => x.medicine.id === m.id);
      if (i >= 0) {
        if (c[i].qty + 1 > m.quantity) { toast.error("Insufficient stock"); return c; }
        const n = [...c]; n[i] = { ...n[i], qty: n[i].qty + 1 }; return n;
      }
      return [...c, { medicine: m, qty: 1 }];
    });
    setSearch("");
  };
  const updateQty = (id: string, qty: number) => {
    setCart((c) => c.map((x) => x.medicine.id === id ? { ...x, qty: Math.max(1, Math.min(qty, x.medicine.quantity)) } : x));
  };
  const removeFromCart = (id: string) => setCart((c) => c.filter((x) => x.medicine.id !== id));

  const totals = useMemo(() => {
    let subtotal = 0, gst = 0, cost = 0;
    cart.forEach((x) => {
      const line = x.medicine.selling_price * x.qty;
      subtotal += line;
      gst += line * (Number(x.medicine.gst) / 100);
      cost += x.medicine.cost_price * x.qty;
    });
    const total = Math.max(0, subtotal + gst - discount);
    const profit = total - cost;
    return { subtotal, gst, total, profit };
  }, [cart, discount]);

  const checkout = async () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    const invoice_number = generateInvoiceNumber("INV");
    const { data: sale, error } = await supabase.from("sales").insert({
      invoice_number,
      customer_name: customer.name || null,
      customer_phone: customer.phone || null,
      subtotal: totals.subtotal,
      gst_amount: totals.gst,
      discount,
      total: totals.total,
      profit: totals.profit,
    }).select().single();
    if (error || !sale) return toast.error(error?.message ?? "Failed");

    const items = cart.map((x) => ({
      sale_id: sale.id, medicine_id: x.medicine.id, medicine_name: x.medicine.name,
      quantity: x.qty, unit_price: x.medicine.selling_price, cost_price: x.medicine.cost_price,
      gst: x.medicine.gst, subtotal: x.medicine.selling_price * x.qty,
    }));
    await supabase.from("sale_items").insert(items);
    for (const x of cart) await adjustStock(x.medicine.id, -x.qty, "sale", sale.id);
    await supabase.from("notifications").insert({ type: "sale", title: "Sale completed", message: `${invoice_number} — ${fmtMoney(totals.total)}` });

    toast.success(`Sale ${invoice_number} completed`);
    printInvoice(invoice_number, customer, cart, totals, discount);
    setCart([]); setCustomer({ name: "", phone: "" }); setDiscount(0);
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Point of Sale" description="Fast billing — search, add to cart, checkout" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search medicine by name, code, generic…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
                {matches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-72 overflow-y-auto">
                    {matches.map((m) => (
                      <button key={m.id} type="button" onClick={() => addToCart(m)}
                        className="flex justify-between w-full px-3 py-2 hover:bg-accent/30 text-left text-sm border-b last:border-b-0">
                        <span><span className="font-medium">{m.name}</span> <span className="text-xs text-muted-foreground">{m.code || m.generic_name || ""}</span></span>
                        <span className="text-xs">{fmtMoney(m.selling_price)} · stock {m.quantity}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Cart</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead className="w-24">Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="text-right">Subtotal</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {cart.length === 0 ? (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Cart is empty</TableCell></TableRow>) :
                    cart.map((x) => (
                      <TableRow key={x.medicine.id}>
                        <TableCell><div className="font-medium">{x.medicine.name}</div><div className="text-xs text-muted-foreground">GST {x.medicine.gst}%</div></TableCell>
                        <TableCell><Input type="number" min={1} max={x.medicine.quantity} value={x.qty} onChange={(e) => updateQty(x.medicine.id, Number(e.target.value))} className="w-20" /></TableCell>
                        <TableCell className="text-right">{fmtMoney(x.medicine.selling_price)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(x.medicine.selling_price * x.qty)}</TableCell>
                        <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => removeFromCart(x.medicine.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Recent Sales</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                      <TableCell className="text-xs">{new Date(r.sale_date).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{fmtMoney(r.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit sticky top-16">
          <CardHeader><CardTitle>Checkout</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Customer Name</Label><Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
            <div><Label>Mobile</Label><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></div>
            <div><Label>Discount</Label><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
            <div className="border-t pt-3 space-y-1 text-sm">
              <Row label="Subtotal" value={fmtMoney(totals.subtotal)} />
              <Row label="GST" value={fmtMoney(totals.gst)} />
              <Row label="Discount" value={`- ${fmtMoney(discount)}`} />
              <div className="flex justify-between text-base font-semibold pt-1 border-t mt-1"><span>Total</span><span>{fmtMoney(totals.total)}</span></div>
              <div className="flex justify-between text-xs text-muted-foreground"><span>Profit</span><span>{fmtMoney(totals.profit)}</span></div>
            </div>
            <Button className="w-full" onClick={checkout} disabled={cart.length === 0}><Printer className="h-4 w-4 mr-1" />Complete Sale & Print</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{value}</span></div>;
}

function printInvoice(inv: string, cust: { name: string; phone: string }, cart: CartItem[], totals: { subtotal: number; gst: number; total: number; profit: number }, discount: number) {
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text("MediShop Pharmacy", 14, 18);
  doc.setFontSize(10); doc.text(`Invoice: ${inv}`, 14, 26);
  doc.text(`Date: ${new Date().toLocaleString()}`, 14, 32);
  if (cust.name) doc.text(`Customer: ${cust.name}`, 14, 38);
  if (cust.phone) doc.text(`Phone: ${cust.phone}`, 14, 44);
  autoTable(doc, {
    startY: 50,
    head: [["Medicine", "Qty", "Price", "GST%", "Subtotal"]],
    body: cart.map((x) => [x.medicine.name, x.qty, x.medicine.selling_price.toFixed(2), `${x.medicine.gst}%`, (x.medicine.selling_price * x.qty).toFixed(2)]),
  });
  // @ts-expect-error jspdf-autotable adds lastAutoTable
  const y = doc.lastAutoTable.finalY + 8;
  doc.text(`Subtotal: ${totals.subtotal.toFixed(2)}`, 140, y);
  doc.text(`GST: ${totals.gst.toFixed(2)}`, 140, y + 6);
  doc.text(`Discount: ${discount.toFixed(2)}`, 140, y + 12);
  doc.setFontSize(12); doc.text(`Total: ${totals.total.toFixed(2)}`, 140, y + 20);
  doc.save(`${inv}.pdf`);
}
