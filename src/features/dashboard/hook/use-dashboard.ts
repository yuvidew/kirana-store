import { useQuery } from "@tanstack/react-query";

import { getDashboardSummary } from "../api";

/**
 * Query hook for the dashboard summary — KPIs, sales trend, low stock,
 * recent bills, top products, and inventory valuation, all from one
 * endpoint.
 * @param options - Optional `refetchInterval` for polling (the dashboard
 * page passes ~60s so a counter screen stays current).
 */
export const useDashboardSummary = (options?: { refetchInterval?: number }) => {
  return useQuery({
    queryFn: getDashboardSummary,
    queryKey: ["dashboard-summary"],
    refetchInterval: options?.refetchInterval,
  });
};
