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

type Category = { id: string; name: string; description: string | null };

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categories — MediShop" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const load = async () => {
    const { data } = await supabase.from("categories").select("*").order("name");
    setItems((data as Category[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Name required");
    const { error } = editingId
      ? await supabase.from("categories").update(form).eq("id", editingId)
      : await supabase.from("categories").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete category?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Categories" description="Organize medicines by type"
        actions={<Button onClick={() => { setForm({ name: "", description: "" }); setEditingId(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Add</Button>} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.description || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setForm({ name: c.name, description: c.description ?? "" }); setEditingId(c.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Category" : "Add Category"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
