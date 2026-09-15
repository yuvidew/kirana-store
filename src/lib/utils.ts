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
