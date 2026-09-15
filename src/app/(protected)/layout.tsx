import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { verifySession } from "@/lib/dal";

/**
 * Shared shell for every authenticated route (dashboard, products, billing,
 * bills, reports). Verifies the session server-side (defense in depth behind
 * `proxy.ts`'s optimistic check) and renders the app sidebar with a slim
 * top bar for the collapse trigger.
 * @param children - The active route's page content.
 */
const ProtectedLayout = async ({ children }: { children: React.ReactNode }) => {
  await verifySession();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <span className="font-heading text-sm font-medium">Kirana Store</span>
        </header>
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default ProtectedLayout;
