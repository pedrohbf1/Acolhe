import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="flex items-center justify-center size-16 rounded-2xl bg-muted">
        <LayoutDashboard className="size-8 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Esta página ainda não foi desenvolvida.
        </p>
      </div>
    </div>
  );
}
