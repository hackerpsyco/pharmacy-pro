import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, AlertTriangle, CalendarClock, PackageX, IndianRupee, TrendingUp, ShoppingCart } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { fmtMoney, expiryStatus, stockStatus } from "@/lib/pharmacy";
import { StatusPill } from "@/components/StatusPill";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MediShop" }] }),
  component: DashboardPage,
});

type Stats = {
  totalMedicines: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  todaySales: number;
  monthSales: number;
  monthProfit: number;
  pendingExpiring30: { name: string; expiry_date: string | null; quantity: number; min_stock: number }[];
  salesByMonth: { month: string; sales: number; profit: number }[];
  purchasesByMonth: { month: string; purchases: number }[];
  topMedicines: { name: string; qty: number }[];
};

function DashboardPage() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const in30 = new Date(today); in30.setDate(in30.getDate() + 30);

      const [meds, salesToday, salesMonth, salesAll, purchasesAll, saleItems] = await Promise.all([
        supabase.from("medicines").select("id,name,quantity,min_stock,expiry_date"),
        supabase.from("sales").select("total,profit").gte("sale_date", today.toISOString()),
        supabase.from("sales").select("total,profit").gte("sale_date", monthStart.toISOString()),
        supabase.from("sales").select("total,profit,sale_date").gte("sale_date", new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString()),
        supabase.from("purchases").select("total_amount,purchase_date").gte("purchase_date", new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10)),
        supabase.from("sale_items").select("medicine_name,quantity"),
      ]);

      const medsData = meds.data ?? [];
      const lowStock = medsData.filter((m) => m.quantity > 0 && m.quantity <= m.min_stock).length;
      const outOfStock = medsData.filter((m) => m.quantity <= 0).length;
      const expiring = medsData.filter((m) => {
        if (!m.expiry_date) return false;
        const e = new Date(m.expiry_date);
        return e >= today && e <= in30;
      });

      const monthMap: Record<string, { sales: number; profit: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        monthMap[d.toISOString().slice(0, 7)] = { sales: 0, profit: 0 };
      }
      (salesAll.data ?? []).forEach((r) => {
        const k = r.sale_date.slice(0, 7);
        if (monthMap[k]) {
          monthMap[k].sales += Number(r.total);
          monthMap[k].profit += Number(r.profit);
        }
      });
      const salesByMonth = Object.entries(monthMap).map(([k, v]) => ({
        month: new Date(k + "-01").toLocaleString("default", { month: "short" }),
        sales: v.sales, profit: v.profit,
      }));

      const purMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        purMap[d.toISOString().slice(0, 7)] = 0;
      }
      (purchasesAll.data ?? []).forEach((r) => {
        const k = r.purchase_date.slice(0, 7);
        if (purMap[k] !== undefined) purMap[k] += Number(r.total_amount);
      });
      const purchasesByMonth = Object.entries(purMap).map(([k, v]) => ({
        month: new Date(k + "-01").toLocaleString("default", { month: "short" }),
        purchases: v,
      }));

      const topMap: Record<string, number> = {};
      (saleItems.data ?? []).forEach((r) => {
        topMap[r.medicine_name] = (topMap[r.medicine_name] ?? 0) + r.quantity;
      });
      const topMedicines = Object.entries(topMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      setS({
        totalMedicines: medsData.length,
        lowStock,
        outOfStock,
        expiringSoon: expiring.length,
        todaySales: (salesToday.data ?? []).reduce((a, b) => a + Number(b.total), 0),
        monthSales: (salesMonth.data ?? []).reduce((a, b) => a + Number(b.total), 0),
        monthProfit: (salesMonth.data ?? []).reduce((a, b) => a + Number(b.profit), 0),
        pendingExpiring30: expiring.slice(0, 6).map((m) => ({
          name: m.name, expiry_date: m.expiry_date, quantity: m.quantity, min_stock: m.min_stock,
        })),
        salesByMonth, purchasesByMonth, topMedicines,
      });
    })();
  }, []);

  if (!s) return <div className="text-muted-foreground">Loading dashboard…</div>;

  const pieColors = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Real-time overview of your pharmacy" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Medicines" value={s.totalMedicines} icon={Pill} tone="primary" />
        <StatCard title="Low Stock" value={s.lowStock} icon={AlertTriangle} tone="warning" />
        <StatCard title="Out of Stock" value={s.outOfStock} icon={PackageX} tone="destructive" />
        <StatCard title="Expiring (30d)" value={s.expiringSoon} icon={CalendarClock} tone="warning" />
        <StatCard title="Today Sales" value={fmtMoney(s.todaySales)} icon={ShoppingCart} tone="success" />
        <StatCard title="Monthly Sales" value={fmtMoney(s.monthSales)} icon={IndianRupee} tone="primary" />
        <StatCard title="Monthly Profit" value={fmtMoney(s.monthProfit)} icon={TrendingUp} tone="success" />
        <StatCard title="Avg / Sale" value={s.monthSales && s.totalMedicines ? fmtMoney(s.monthSales / Math.max(1, s.totalMedicines)) : "—"} icon={IndianRupee} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Sales & Profit (last 6 months)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" /><YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sales" stroke="var(--color-chart-1)" strokeWidth={2} />
                <Line type="monotone" dataKey="profit" stroke="var(--color-chart-2)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Selling</CardTitle></CardHeader>
          <CardContent className="h-72">
            {s.topMedicines.length === 0 ? (
              <div className="text-sm text-muted-foreground">No sales yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={s.topMedicines} dataKey="qty" nameKey="name" outerRadius={80}>
                    {s.topMedicines.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Purchases (last 6 months)</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.purchasesByMonth}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" /><YAxis />
                <Tooltip />
                <Bar dataKey="purchases" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expiry & Stock Alerts</CardTitle></CardHeader>
          <CardContent>
            {s.pendingExpiring30.length === 0 ? (
              <div className="text-sm text-muted-foreground">No items expiring in the next 30 days.</div>
            ) : (
              <ul className="space-y-2">
                {s.pendingExpiring30.map((m, i) => {
                  const exp = expiryStatus(m.expiry_date);
                  const st = stockStatus(m);
                  return (
                    <li key={i} className="flex items-center justify-between text-sm border rounded-md p-2.5">
                      <span className="font-medium truncate">{m.name}</span>
                      <span className="flex items-center gap-2">
                        <StatusPill tone={st.tone}>{st.label}</StatusPill>
                        <StatusPill tone={exp.tone}>{exp.label}</StatusPill>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
