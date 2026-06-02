# Medicine Shop Management — Build Plan

Large ERP-style app delivered in phases. Lovable Cloud powers auth, database, storage, and server logic.

## Role model — Admin only
- Single role: **admin**. No manager/staff tiers.
- No public signup. Admin account is seeded: `aimedicine@gmail.com` / `collegemedicine`.
- Additional admins can be added later from Settings if you want; default is single-admin.

## Phase 1 (this build) — Core working pharmacy ERP

**Auth**
- Lovable Cloud email/password
- Seeded admin user
- Login, logout, change password, login activity log
- All app routes behind `_authenticated` gate

**Database (Postgres + RLS)**
- `profiles`, `user_roles` (admin only), `login_activity`
- `categories` (pre-seeded: Tablets, Syrups, Antibiotics, Pain Relief, Diabetes, BP, Heart, Baby Care, Skin Care, Vitamins, First Aid, Medical Equipment)
- `suppliers`
- `medicines` (name, code/barcode, generic, brand, category, batch, manufacturer, supplier, mfg/expiry dates, cost/sell price, GST, qty, dosage type, prescription flag, rack, image, description)
- `purchases` + `purchase_items` (auto stock-in)
- `sales` + `sale_items` (auto stock-out)
- `stock_movements` (audit trail)
- `notifications`
- Storage bucket for medicine images & prescription uploads
- RLS: admin-only access on all tables, enforced via `has_role()` security-definer

**Dashboard**
- KPI cards: Total Medicines, Low Stock, Expiring Soon, Out of Stock, Today Sales, Monthly Sales, Profit, Pending
- Charts: monthly sales, purchases, profit, top-selling
- Alerts: expiring 30/60/90, low/out-of-stock

**Modules**
- Medicines — full CRUD, search/filter/sort, image upload
- Categories — CRUD
- Suppliers — CRUD + purchase history
- Purchases — invoice with line items, auto stock + cost update, PDF
- Sales / POS — fast search, cart, discount, GST, customer info, prescription upload, auto stock decrement, printable + PDF invoice
- Stock — live status, batch-wise view, movement history
- Expiry tracker — Expired / 7d / 30d / 60d / Safe tabs
- Reports — daily/weekly/monthly sales, profit/loss, stock, expiry, purchase; export CSV / Excel / PDF
- Notifications center
- Settings — profile, change password, activity log
- Dark mode toggle

**Design**
- White + Light Blue + Medical Green theme via semantic tokens in `src/styles.css`
- Sidebar layout, clean tables, responsive, mobile-friendly
- shadcn components with custom medical variants

**Security**
- RLS on every table, admin role checked via security-definer function
- All mutations through `createServerFn` + `requireSupabaseAuth`
- Zod validation everywhere
- Service-role key never exposed client-side

## Phase 2 (later)
- Barcode camera scanning
- Medicine recommendation while billing
- Auto stock prediction
- Backup/restore
- Full audit log UI

## Tech
TanStack Start + Lovable Cloud (Supabase) + Tailwind v4 + shadcn/ui + Recharts + jsPDF.

Approve and I'll start: enable Lovable Cloud → schema + RLS → seed admin → auth flow → modules.
