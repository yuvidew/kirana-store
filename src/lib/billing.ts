// A single configurable GST rate for the whole store, per plan-docs.md —
// NEXT_PUBLIC_ so both the billing form's live preview and the bill-creation
// Route Handler read the identical value.
export const GST_RATE_PERCENT = Number(process.env.NEXT_PUBLIC_GST_RATE_PERCENT ?? 5);

export type BillTotals = {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
};

/**
 * Computes a bill's subtotal/discount/tax/total from its line items and
 * discount choice. Used identically by the billing form's live preview and
 * the bill-creation Route Handler, so the two never drift.
 * @param subtotal - Sum of all line items' `quantity * unitPrice`.
 * @param discountType - "flat" (₹ amount) or "percent" (% of subtotal).
 * @param discountValue - The entered discount number; 0 means no discount.
 * @param taxRatePercent - GST rate to apply; defaults to `GST_RATE_PERCENT`.
 */
export const calculateBillTotals = ({
  subtotal,
  discountType,
  discountValue,
  taxRatePercent = GST_RATE_PERCENT,
}: {
  subtotal: number;
  discountType: "flat" | "percent";
  discountValue: number;
  taxRatePercent?: number;
}): BillTotals => {
  const rawDiscount = discountType === "percent" ? subtotal * (discountValue / 100) : discountValue;
  const discountAmount = Math.min(Math.max(rawDiscount, 0), subtotal);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRatePercent / 100);
  return { subtotal, discountAmount, taxableAmount, taxAmount, totalAmount: taxableAmount + taxAmount };
};
