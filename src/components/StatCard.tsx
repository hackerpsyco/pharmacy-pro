import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  title, value, icon: Icon, hint, tone = "primary",
}: {
  title: string; value: string | number; icon: LucideIcon; hint?: string;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
  } as const;
  return (
    <Card className="border-border/60">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("h-12 w-12 rounded-xl grid place-items-center shrink-0", toneMap[tone])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="text-2xl font-semibold mt-0.5 truncate">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-0.5 truncate">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
