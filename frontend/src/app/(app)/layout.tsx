import { AppSidebar } from "@/components/AppSidebar";
<<<<<<< HEAD
import { AuthProvider } from "@/providers/AuthProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </AuthProvider>
=======
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
>>>>>>> 37661d5dc2379363d68df00bdea4d22d4bccc0d0
  );
}
