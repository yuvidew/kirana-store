import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

// Used for currency amounts, quantities, and stock counts so figures line
// up in fixed-width columns, ledger-style.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Kirana Store",
  description: "Billing & inventory management for a local Kirana store.",
};

/**
 * Root layout — wraps every route in the TanStack Query provider, the
 * shadcn TooltipProvider, and the Toaster (needed for `toast.add(...)`).
 * @param children - The active route tree.
 */
const RootLayout = ({ children }: LayoutProps<"/">) => {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", plexSans.variable, plexMono.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <TooltipProvider>
            <Toaster>{children}</Toaster>
          </TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
};

export default RootLayout;
