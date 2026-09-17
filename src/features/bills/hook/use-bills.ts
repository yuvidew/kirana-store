import { useQuery } from "@tanstack/react-query";

import { getBill } from "../api";

/**
 * Query hook for a single bill (the receipt/print/share view).
 * @param id - The bill's id.
 */
export const useBill = (id: number) => {
  return useQuery({
    queryFn: () => getBill(id),
    queryKey: ["bill", id],
  });
};
