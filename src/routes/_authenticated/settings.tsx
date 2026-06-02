import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — MediShop" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [activity, setActivity] = useState<{ id: string; email: string | null; event: string; created_at: string }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    supabase.from("login_activity").select("id,email,event,created_at").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setActivity(data ?? []));
  }, []);

  const changePassword = async () => {
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return toast.error(error.message);
    setNewPassword(""); toast.success("Password updated");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Profile, security, and activity" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Email</Label><Input value={email} disabled /></div>
            <div><Label>Role</Label><Input value="Admin" disabled /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>New password</Label><Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
            <Button onClick={changePassword}>Update Password</Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Login Activity</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Email</TableHead><TableHead>Event</TableHead></TableRow></TableHeader>
            <TableBody>
              {activity.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell>{a.email || "—"}</TableCell>
                  <TableCell className="capitalize">{a.event}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
