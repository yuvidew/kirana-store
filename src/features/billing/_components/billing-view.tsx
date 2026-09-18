"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateBillTotals } from "@/lib/billing";
import type { Product } from "@/features/products/types";

import { useCreateBill } from "../hook/use-billing";
import type { DiscountType, PaymentMode } from "../types";
import { BillLineItemsTable } from "./bill-line-items-table";
import { BillSummaryCard } from "./bill-summary-card";
import { ProductPicker } from "./product-picker";

/** A product added to the bill being built, enriched with display fields. */
export type BillLineItem = {
  productId: number;
  productName: string;
  unit: string;
  price: number;
  stock: number;
  quantity: number;
};

/**
 * Bill-generation page: a two-column checkout layout — the cart (product
 * picker + line items) on the left, a sticky order-summary/checkout panel
 * on the right (stacks below the cart on narrow screens). Redirects to the
 * bills list on success, with a `?billId=` param that opens the new bill's
 * receipt dialog there.
 */
export const BillingView = () => {
  const router = useRouter();
  const [lineItems, setLineItems] = useState<BillLineItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [discountType, setDiscountType] = useState<DiscountType>("flat");
  const [discountValue, setDiscountValue] = useState(0);
  const createBillMutation = useCreateBill();

  // Adding a product already on the bill increments its quantity instead of
  // duplicating a row — the server expects one line item per productId.
  const handleAddProduct = (product: Product) => {
    setLineItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          unit: product.unit,
          price: Number(product.price),
          stock: Number(product.stock),
          quantity: 1,
        },
      ];
    });
  };

  const handleQuantityChange = (productId: number, quantity: number) => {
    setLineItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item))
    );
  };

  const handleRemove = (productId: number) => {
    setLineItems((current) => current.filter((item) => item.productId !== productId));
  };

  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [lineItems]);
  const totals = useMemo(
    () => calculateBillTotals({ subtotal, discountType, discountValue }),
    [subtotal, discountType, discountValue]
  );

  const handleSubmit = () => {
    createBillMutation.mutate(
      {
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        paymentMode,
        discountType,
        discountValue,
        items: lineItems.map(({ productId, quantity }) => ({ productId, quantity })),
      },
      { onSuccess: (bill) => router.push(`/bills?billId=${bill.id}`) }
    );
  };

  const canSubmit =
    lineItems.length > 0 &&
    (paymentMode !== "udhaar" || customerPhone.trim().length > 0) &&
    !createBillMutation.isPending;

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="font-heading text-xl font-semibold tracking-tight">New bill</h1>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add products</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductPicker onAdd={handleAddProduct} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <Badge variant="secondary">
                {lineItems.length} {lineItems.length === 1 ? "item" : "items"}
              </Badge>
            </CardHeader>
            <CardContent>
              <BillLineItemsTable
                lineItems={lineItems}
                onQuantityChange={handleQuantityChange}
                onRemove={handleRemove}
              />
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-6">
          <BillSummaryCard
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            customerPhone={customerPhone}
            onCustomerPhoneChange={setCustomerPhone}
            paymentMode={paymentMode}
            onPaymentModeChange={setPaymentMode}
            discountType={discountType}
            onDiscountTypeChange={setDiscountType}
            discountValue={discountValue}
            onDiscountValueChange={setDiscountValue}
            totals={totals}
            onSubmit={handleSubmit}
            canSubmit={canSubmit}
            isPending={createBillMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
};
