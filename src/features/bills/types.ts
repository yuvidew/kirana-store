// unitPrice/lineTotal/discount/taxAmount/totalAmount are Decimal fields on
// the server — they serialize to JSON as strings, matching the same
// convention used by src/features/products/types.ts.
export type BillItemDto = {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

export type Bill = {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  customerId: number | null;
  isCredit: boolean;
  // subtotal is derived (sum of line totals), not a DB column — a
  // convenience for the receipt view, computed by the server's DTO mapper.
  subtotal: string;
  discount: string;
  taxAmount: string;
  totalAmount: string;
  createdAt: string;
  items: BillItemDto[];
};

export type BillResponse = {
  bill: Bill;
};

/** Payment-status filter for the bills list — "all" applies no isCredit filter. */
export const BILL_PAYMENT_FILTERS = ["all", "cash", "udhaar"] as const;
export type BillPaymentFilter = (typeof BILL_PAYMENT_FILTERS)[number];

/**
 * Lightweight row shape for the bills list/history table — an `itemCount`
 * instead of full `items`, since the list endpoint doesn't eager-load line
 * items/products the way the single-bill detail endpoint does.
 */
export type BillListItem = {
  id: number;
  customerName: string | null;
  customerPhone: string | null;
  isCredit: boolean;
  totalAmount: string;
  itemCount: number;
  createdAt: string;
};

export type BillsQuery = {
  search?: string;
  payment?: BillPaymentFilter;
  dateFrom?: string; // "yyyy-MM-dd", inclusive, local calendar day
  dateTo?: string; // "yyyy-MM-dd", inclusive, local calendar day
  page?: number;
  pageSize?: number;
};

export type BillsResponse = {
  bills: BillListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};
