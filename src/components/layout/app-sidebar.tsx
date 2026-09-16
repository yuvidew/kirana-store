"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3Icon,
  FileTextIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptTextIcon,
} from "lucide-react";

import { LogoutButton } from "@/features/auth/_components/logout-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
  { title: "Products", url: "/products", icon: PackageIcon },
  { title: "Billing", url: "/billing", icon: ReceiptTextIcon },
  { title: "Bills", url: "/bills", icon: FileTextIcon },
  { title: "Reports", url: "/reports", icon: BarChart3Icon },
];

/**
 * App-wide sidebar navigation linking Dashboard, Products, Billing, Bills,
 * and Reports. Renders inside the `(protected)` layout's `SidebarProvider`.
 */
export const AppSidebar = () => {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <span className="border-b border-sidebar-border px-2 pt-1 pb-3 font-heading text-base font-semibold tracking-tight">
          Kirana Store
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                // Matches proxy.ts's protected-route prefix check, so a
                // nested route (e.g. /bills/1) still highlights its parent.
                const isActive =
                  pathname === item.url || pathname.startsWith(`${item.url}/`);

                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      render={<Link href={item.url} />}
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <LogoutButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
