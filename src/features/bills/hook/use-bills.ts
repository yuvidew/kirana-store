import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { allBills, getBill } from "../api";
import type { BillsQuery } from "../types";

/**
 * Query hook for the paginated, filtered bills list/history.
 * @param query - `search`/`payment`/`dateFrom`/`dateTo`/`page`/`pageSize` filters.
 * @param options - Optional `refetchInterval` for polling.
 */
export const useAllBills = (query: BillsQuery, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryFn: () => allBills(query),
    queryKey: ["all-bills", query],
    placeholderData: keepPreviousData,
    refetchInterval: options?.refetchInterval,
  });
};

/**
 * Query hook for a single bill (the receipt/print/share dialog).
 * @param id - The bill's id.
 * @param options - Optional `enabled` to defer fetching until a bill is actually selected.
 */
export const useBill = (id: number, options?: { enabled?: boolean }) => {
  return useQuery({
    queryFn: () => getBill(id),
    queryKey: ["bill", id],
    enabled: options?.enabled ?? true,
  });
};
