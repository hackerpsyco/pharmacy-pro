import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Supplier = { id: string; name: string; phone: string | null; email: string | null; address: string | null; gst_number: string | null };

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — MediShop" }] }),
  component: SuppliersPage,
});

const empty = { name: "", phone: "", email: "", address: "", gst_number: "" };

function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setItems((data as Supplier[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    const { error } = editingId
      ? await supabase.from("suppliers").update(form).eq("id", editingId)
      : await supabase.from("suppliers").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete supplier?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Suppliers" description="Manage your medicine suppliers"
        actions={<Button onClick={() => { setForm(empty); setEditingId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button>} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>GST</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No suppliers</TableCell></TableRow> :
                items.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.phone || "—"}</TableCell>
                    <TableCell>{s.email || "—"}</TableCell>
                    <TableCell>{s.gst_number || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setForm({ name: s.name, phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", gst_number: s.gst_number ?? "" });
                        setEditingId(s.id); setOpen(true);
                      }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Supplier" : "Add Supplier"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>GST Number</Label><Input value={form.gst_number} onChange={(e) => setForm({ ...form, gst_number: e.target.value })} /></div>
            <div className="col-span-2"><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
