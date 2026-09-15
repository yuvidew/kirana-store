import { LogoutButton } from "@/features/auth/_components/logout-button";
import { verifySession } from "@/lib/dal";

/**
 * Shared shell for every authenticated route (dashboard, products, billing,
 * bills, reports). Verifies the session server-side (defense in depth behind
 * `proxy.ts`'s optimistic check) and renders a minimal header with logout.
 * @param children - The active route's page content.
 */
const ProtectedLayout = async ({ children }: { children: React.ReactNode }) => {
  await verifySession();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-heading text-sm font-medium">Kirana Store</span>
        <LogoutButton />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
};

export default ProtectedLayout;
