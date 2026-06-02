import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney } from "@/lib/pharmacy";
import { Download, FileSpreadsheet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — MediShop" }] }),
  component: ReportsPage,
});

type Sale = { invoice_number: string; total: number; profit: number; sale_date: string };
type Med = { name: string; quantity: number; cost_price: number; selling_price: number; expiry_date: string | null };

function ReportsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [meds, setMeds] = useState<Med[]>([]);

  useEffect(() => {
    (async () => {
      const [s, m] = await Promise.all([
        supabase.from("sales").select("invoice_number,total,profit,sale_date").order("sale_date", { ascending: false }).limit(200),
        supabase.from("medicines").select("name,quantity,cost_price,selling_price,expiry_date"),
      ]);
      setSales((s.data as Sale[]) ?? []); setMeds((m.data as Med[]) ?? []);
    })();
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const sum = (arr: Sale[], k: "total" | "profit") => arr.reduce((a, b) => a + Number(b[k]), 0);
  const todaySales = sales.filter((s) => new Date(s.sale_date) >= today);
  const weekSales = sales.filter((s) => new Date(s.sale_date) >= weekAgo);
  const monthSales = sales.filter((s) => new Date(s.sale_date) >= monthStart);

  const downloadCsv = (filename: string, rows: Record<string, unknown>[]) => {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };
  const downloadXlsx = (filename: string, rows: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, filename);
  };
  const downloadPdf = (title: string, rows: Record<string, unknown>[]) => {
    const doc = new jsPDF(); doc.text(title, 14, 16);
    if (rows.length) {
      autoTable(doc, { startY: 22, head: [Object.keys(rows[0])], body: rows.map((r) => Object.values(r) as never) });
    }
    doc.save(title.replace(/\s+/g, "_") + ".pdf");
  };

  const ReportCard = ({ title, count, value, data }: { title: string; count: number; value: string; data: Record<string, unknown>[] }) => (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground">{count} records · <span className="text-foreground font-semibold">{value}</span></div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => downloadCsv(`${title}.csv`, data)}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => downloadXlsx(`${title}.xlsx`, data)}><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Excel</Button>
          <Button size="sm" variant="outline" onClick={() => downloadPdf(title, data)}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
        </div>
      </CardContent>
    </Card>
  );

  const stockValue = meds.reduce((a, m) => a + m.quantity * Number(m.selling_price), 0);
  const profitLoss = sum(monthSales, "profit");

  return (
    <div className="space-y-4">
      <PageHeader title="Reports & Analytics" description="Export sales, stock, and profit reports" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ReportCard title="Daily Sales" count={todaySales.length} value={fmtMoney(sum(todaySales, "total"))} data={todaySales as never} />
        <ReportCard title="Weekly Sales" count={weekSales.length} value={fmtMoney(sum(weekSales, "total"))} data={weekSales as never} />
        <ReportCard title="Monthly Sales" count={monthSales.length} value={fmtMoney(sum(monthSales, "total"))} data={monthSales as never} />
        <ReportCard title="Profit & Loss (Month)" count={monthSales.length} value={fmtMoney(profitLoss)} data={monthSales as never} />
        <ReportCard title="Stock Report" count={meds.length} value={fmtMoney(stockValue)} data={meds as never} />
        <ReportCard title="Expiry Report" count={meds.filter((m) => m.expiry_date).length} value="—"
          data={meds.filter((m) => m.expiry_date).sort((a, b) => (a.expiry_date! < b.expiry_date! ? -1 : 1)) as never} />
      </div>
    </div>
  );
}
