import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getReportsSummary } from "../api";
import type { ReportsQuery } from "../types";

/**
 * Query hook for the reports summary over a date range — the one endpoint
 * backing the whole /reports page (period cards, sales trend,
 * bills-per-day, stock movement, top products).
 * @param query - `dateFrom`/`dateTo` ("yyyy-MM-dd") defining the period.
 * @param options - Optional `refetchInterval` for polling (unused by
 * default — reports isn't a counter-screen page like the dashboard).
 */
export const useReportsSummary = (query: ReportsQuery, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryFn: () => getReportsSummary(query),
    queryKey: ["reports-summary", query],
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchInterval,
  });
};
