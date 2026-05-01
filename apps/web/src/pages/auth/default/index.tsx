import { Copyright } from "lucide-react";
import { Outlet } from "react-router-dom";

export default function DefaultAuthPage() {
  return (
    <main className="h-dvh w-full p-6 flex">
      <section className="flex justify-between flex-1 pr-6 flex-col">
        <div className="h-full">
          <Outlet />
        </div>
        <div className="flex text-xs gap-1">
          <Copyright size={15} />
          <span>{new Date().getFullYear()} useAcolhe</span>
        </div>
      </section>
      <div className="relative flex flex-1 w-full max-md:hidden">
        <section className="flex flex-1 rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/20" />
      </div>
    </main>
  );
}
