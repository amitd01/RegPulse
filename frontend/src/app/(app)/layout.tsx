import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { AuthProvider } from "@/providers/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#F5F2EB] dark:bg-navy-950">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
