import { createFileRoute } from "@tanstack/react-router";

const ADMIN_EMAIL = "aimedicine@gmail.com";
const ADMIN_PASSWORD = "collegemedicine";

export const Route = createFileRoute("/api/public/init-admin")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: list } = await supabaseAdmin.auth.admin.listUsers();
        const exists = list?.users.some((u) => u.email === ADMIN_EMAIL);
        if (exists) {
          return Response.json({ ok: true, created: false });
        }
        const { error } = await supabaseAdmin.auth.admin.createUser({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: "Pharmacy Admin" },
        });
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }
        return Response.json({ ok: true, created: true });
      },
    },
  },
});
