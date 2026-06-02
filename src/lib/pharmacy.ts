import { supabase } from "@/integrations/supabase/client";

export type Medicine = {
  id: string;
  name: string;
  code: string | null;
  generic_name: string | null;
  brand_name: string | null;
  category_id: string | null;
  batch_number: string | null;
  manufacturer: string | null;
  supplier_id: string | null;
  mfg_date: string | null;
  expiry_date: string | null;
  cost_price: number;
  selling_price: number;
  gst: number;
  quantity: number;
  min_stock: number;
  dosage_type: string | null;
  prescription_required: boolean;
  rack_number: string | null;
  description: string | null;
  image_url: string | null;
};

export const DOSAGE_TYPES = [
  "Tablet", "Syrup", "Injection", "Capsule", "Cream", "Drops", "Powder", "Medical Equipment", "Other",
];

export const fmtMoney = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n ?? 0));

export const stockStatus = (m: { quantity: number; min_stock: number }) => {
  if (m.quantity <= 0) return { label: "Out of Stock", tone: "destructive" as const };
  if (m.quantity <= m.min_stock) return { label: "Low Stock", tone: "warning" as const };
  return { label: "In Stock", tone: "success" as const };
};

export const expiryStatus = (expiry_date: string | null) => {
  if (!expiry_date) return { label: "—", days: null as number | null, tone: "muted" as const };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiry_date);
  const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: "Expired", days, tone: "destructive" as const };
  if (days <= 7) return { label: `${days}d left`, days, tone: "destructive" as const };
  if (days <= 30) return { label: `${days}d left`, days, tone: "warning" as const };
  if (days <= 60) return { label: `${days}d left`, days, tone: "warning" as const };
  return { label: `${days}d`, days, tone: "success" as const };
};

export async function adjustStock(medicine_id: string, change: number, reason: string, reference_id?: string) {
  const { data: med } = await supabase.from("medicines").select("quantity").eq("id", medicine_id).single();
  const newQty = (med?.quantity ?? 0) + change;
  await supabase.from("medicines").update({ quantity: newQty }).eq("id", medicine_id);
  await supabase.from("stock_movements").insert({
    medicine_id, change, reason, reference_id: reference_id ?? null,
  });
}

export function generateInvoiceNumber(prefix = "INV") {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9000) + 1000}`;
  return `${prefix}-${stamp}`;
}
