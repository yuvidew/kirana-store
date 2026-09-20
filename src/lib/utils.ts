export { cn } from "cn"

/**
 * Formats a price/amount as Indian Rupees, e.g. `formatCurrency("45.5")` → "₹45.50".
 * @param value - The amount, as a number or a Decimal-serialized string.
 */
export const formatCurrency = (value: number | string) => {
  const amount = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

/**
 * Recharts `<XAxis interval>` value that skips enough tick labels to stay
 * readable once a period has more than ~14 days of points (e.g. a custom
 * multi-month range) — every data point still renders, only the label
 * density changes.
 * @param pointCount - Number of points on the axis (one per day).
 */
export const chartTickInterval = (pointCount: number) => (pointCount > 14 ? Math.ceil(pointCount / 12) : 0);
