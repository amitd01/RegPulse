import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto bg-cream-100 dark:bg-navy-950">
          {children}
        </main>
      </div>
    </div>
  );
}
