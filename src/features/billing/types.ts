import type { Bill } from "@/features/bills/types";

export const PAYMENT_MODES = ["cash", "udhaar"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const DISCOUNT_TYPES = ["flat", "percent"] as const;
export type DiscountType = (typeof DISCOUNT_TYPES)[number];

export type BillLineItemInput = {
  productId: number;
  quantity: number;
};

export type CreateBillInput = {
  customerName?: string;
  customerPhone?: string;
  paymentMode: PaymentMode;
  discountType: DiscountType;
  discountValue: number;
  items: BillLineItemInput[];
};

export type CreateBillResponse = {
  bill: Bill;
};
