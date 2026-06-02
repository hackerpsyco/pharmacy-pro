import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { StatusPill } from "@/components/StatusPill";
import { DOSAGE_TYPES, expiryStatus, fmtMoney, stockStatus, type Medicine } from "@/lib/pharmacy";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/medicines")({
  head: () => ({ meta: [{ title: "Medicines — MediShop" }] }),
  component: MedicinesPage,
});

type Category = { id: string; name: string };
type Supplier = { id: string; name: string };

const empty: Partial<Medicine> = {
  name: "", code: "", generic_name: "", brand_name: "", batch_number: "",
  manufacturer: "", mfg_date: "", expiry_date: "",
  cost_price: 0, selling_price: 0, gst: 0, quantity: 0, min_stock: 10,
  dosage_type: "Tablet", prescription_required: false, rack_number: "",
  description: "", image_url: "",
};

function MedicinesPage() {
  const [items, setItems] = useState<Medicine[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [sups, setSups] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Medicine>>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    const [m, c, s] = await Promise.all([
      supabase.from("medicines").select("*").order("name"),
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("suppliers").select("id,name").order("name"),
    ]);
    setItems((m.data as Medicine[]) ?? []);
    setCats((c.data as Category[]) ?? []);
    setSups((s.data as Supplier[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditingId(null); setOpen(true); };
  const openEdit = (m: Medicine) => { setForm(m); setEditingId(m.id); setOpen(true); };

  const save = async () => {
    if (!form.name) return toast.error("Name is required");
    const payload = {
      name: form.name,
      code: form.code || null,
      generic_name: form.generic_name || null,
      brand_name: form.brand_name || null,
      category_id: form.category_id || null,
      supplier_id: form.supplier_id || null,
      batch_number: form.batch_number || null,
      manufacturer: form.manufacturer || null,
      mfg_date: form.mfg_date || null,
      expiry_date: form.expiry_date || null,
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      gst: Number(form.gst) || 0,
      quantity: Number(form.quantity) || 0,
      min_stock: Number(form.min_stock) || 0,
      dosage_type: (form.dosage_type ?? "Tablet") as never,
    };
    const { error } = editingId
      ? await supabase.from("medicines").update(payload).eq("id", editingId)
      : await supabase.from("medicines").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Updated" : "Medicine added");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this medicine?")) return;
    const { error } = await supabase.from("medicines").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const filtered = items.filter((m) => {
    const q = search.toLowerCase();
    const matches = !q || m.name.toLowerCase().includes(q) || (m.code ?? "").toLowerCase().includes(q) ||
      (m.batch_number ?? "").toLowerCase().includes(q) || (m.manufacturer ?? "").toLowerCase().includes(q);
    const catOk = filterCat === "all" || m.category_id === filterCat;
    return matches && catOk;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Medicines"
        description="Manage your medicine inventory"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Medicine</Button>}
      />

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, code, batch, manufacturer…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead><TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Price</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No medicines found</TableCell></TableRow>
                ) : filtered.map((m) => {
                  const st = stockStatus(m); const ex = expiryStatus(m.expiry_date);
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.generic_name || m.brand_name || "—"}</div>
                      </TableCell>
                      <TableCell className="text-xs">{m.code || "—"}</TableCell>
                      <TableCell className="text-xs">{m.batch_number || "—"}</TableCell>
                      <TableCell className="text-xs"><StatusPill tone={ex.tone}>{ex.label}</StatusPill></TableCell>
                      <TableCell className="text-right">{m.quantity}</TableCell>
                      <TableCell className="text-right">{fmtMoney(m.selling_price)}</TableCell>
                      <TableCell><StatusPill tone={st.tone}>{st.label}</StatusPill></TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Edit Medicine" : "Add Medicine"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Name *"><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Code / Barcode"><Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Generic Name"><Input value={form.generic_name ?? ""} onChange={(e) => setForm({ ...form, generic_name: e.target.value })} /></Field>
            <Field label="Brand Name"><Input value={form.brand_name ?? ""} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} /></Field>
            <Field label="Category">
              <Select value={form.category_id ?? ""} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Supplier">
              <Select value={form.supplier_id ?? ""} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{sups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Batch Number"><Input value={form.batch_number ?? ""} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} /></Field>
            <Field label="Manufacturer"><Input value={form.manufacturer ?? ""} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} /></Field>
            <Field label="Manufacturing Date"><Input type="date" value={form.mfg_date ?? ""} onChange={(e) => setForm({ ...form, mfg_date: e.target.value })} /></Field>
            <Field label="Expiry Date"><Input type="date" value={form.expiry_date ?? ""} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field>
            <Field label="Cost Price"><Input type="number" step="0.01" value={form.cost_price ?? 0} onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })} /></Field>
            <Field label="Selling Price"><Input type="number" step="0.01" value={form.selling_price ?? 0} onChange={(e) => setForm({ ...form, selling_price: Number(e.target.value) })} /></Field>
            <Field label="GST %"><Input type="number" step="0.01" value={form.gst ?? 0} onChange={(e) => setForm({ ...form, gst: Number(e.target.value) })} /></Field>
            <Field label="Quantity"><Input type="number" value={form.quantity ?? 0} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></Field>
            <Field label="Minimum Stock"><Input type="number" value={form.min_stock ?? 0} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} /></Field>
            <Field label="Dosage Type">
              <Select value={form.dosage_type ?? "Tablet"} onValueChange={(v) => setForm({ ...form, dosage_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOSAGE_TYPES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Rack Number"><Input value={form.rack_number ?? ""} onChange={(e) => setForm({ ...form, rack_number: e.target.value })} /></Field>
            <Field label="Image URL"><Input value={form.image_url ?? ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })} /></Field>
            <div className="flex items-center gap-3 mt-2">
              <Switch checked={!!form.prescription_required} onCheckedChange={(v) => setForm({ ...form, prescription_required: v })} />
              <Label>Prescription required</Label>
            </div>
            <div className="md:col-span-2">
              <Field label="Description"><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editingId ? "Save changes" : "Add Medicine"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
