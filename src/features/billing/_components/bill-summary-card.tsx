"use client";

import { ReceiptIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { BillTotals } from "@/lib/billing";
import { formatCurrency } from "@/lib/utils";

import { DISCOUNT_TYPES, PAYMENT_MODES } from "../types";
import type { DiscountType, PaymentMode } from "../types";

const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = { cash: "Cash", udhaar: "Udhaar" };
const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = { flat: "₹ Flat", percent: "% Percent" };

/**
 * The checkout panel: customer/payment/discount controls, the live
 * subtotal/discount/tax/total breakdown, and the "Generate bill" action —
 * everything needed to finish a bill, in one sticky card.
 * @param customerName - Current customer name field value.
 * @param onCustomerNameChange - Called with the new customer name.
 * @param customerPhone - Current customer phone field value.
 * @param onCustomerPhoneChange - Called with the new customer phone.
 * @param paymentMode - Current payment mode (cash/udhaar).
 * @param onPaymentModeChange - Called with the new payment mode.
 * @param discountType - Current discount type (flat/percent).
 * @param onDiscountTypeChange - Called with the new discount type.
 * @param discountValue - Current discount value.
 * @param onDiscountValueChange - Called with the new discount value.
 * @param totals - The live subtotal/discount/tax/total breakdown to display.
 * @param onSubmit - Called when "Generate bill" is clicked.
 * @param canSubmit - Whether the bill is currently valid to submit.
 * @param isPending - Whether the create-bill request is in flight.
 */
export const BillSummaryCard = ({
  customerName,
  onCustomerNameChange,
  customerPhone,
  onCustomerPhoneChange,
  paymentMode,
  onPaymentModeChange,
  discountType,
  onDiscountTypeChange,
  discountValue,
  onDiscountValueChange,
  totals,
  onSubmit,
  canSubmit,
  isPending,
}: {
  customerName: string;
  onCustomerNameChange: (value: string) => void;
  customerPhone: string;
  onCustomerPhoneChange: (value: string) => void;
  paymentMode: PaymentMode;
  onPaymentModeChange: (value: PaymentMode) => void;
  discountType: DiscountType;
  onDiscountTypeChange: (value: DiscountType) => void;
  discountValue: number;
  onDiscountValueChange: (value: number) => void;
  totals: BillTotals;
  onSubmit: () => void;
  canSubmit: boolean;
  isPending: boolean;
}) => {
  const isUdhaar = paymentMode === "udhaar";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkout</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="customerName">Customer name (optional)</FieldLabel>
            <Input
              id="customerName"
              value={customerName}
              onChange={(event) => onCustomerNameChange(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="customerPhone">
              Phone number {isUdhaar ? "(required for Udhaar)" : "(optional)"}
            </FieldLabel>
            <Input
              id="customerPhone"
              value={customerPhone}
              onChange={(event) => onCustomerPhoneChange(event.target.value)}
              required={isUdhaar}
            />
          </Field>
          <Field>
            <FieldLabel>Payment mode</FieldLabel>
            <ButtonGroup className="w-full">
              {PAYMENT_MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={paymentMode === mode ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => onPaymentModeChange(mode)}
                >
                  {PAYMENT_MODE_LABELS[mode]}
                </Button>
              ))}
            </ButtonGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="discountValue">Discount</FieldLabel>
            <div className="flex gap-2">
              <ButtonGroup>
                {DISCOUNT_TYPES.map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={discountType === type ? "default" : "outline"}
                    onClick={() => onDiscountTypeChange(type)}
                  >
                    {DISCOUNT_TYPE_LABELS[type]}
                  </Button>
                ))}
              </ButtonGroup>
              <Input
                id="discountValue"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={discountValue || ""}
                onChange={(event) => onDiscountValueChange(Number(event.target.value) || 0)}
                className="flex-1 font-mono tabular-nums"
              />
            </div>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3 border-t">
        <div className="flex flex-col gap-1 font-mono text-sm tabular-nums">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Discount</span>
            <span>-{formatCurrency(totals.discountAmount)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{formatCurrency(totals.taxAmount)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold text-foreground">
            <span>Total</span>
            <span>{formatCurrency(totals.totalAmount)}</span>
          </div>
        </div>
        <Button size="lg" className="w-full" disabled={!canSubmit} onClick={onSubmit}>
          <ReceiptIcon />
          {isPending ? "Generating…" : "Generate bill"}
        </Button>
      </CardFooter>
    </Card>
  );
};
