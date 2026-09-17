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
