"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Wraps the app in a TanStack Query QueryClientProvider.
 * @param children - The subtree to render inside the provider.
 */
export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  // Created once via useState's initializer, not on every render —
  // otherwise the cache would be thrown away and recreated each time.
  const [queryClient] = useState(() => new QueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};
