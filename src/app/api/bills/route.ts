import { NextResponse } from "next/server";
import * as z from "zod";

import type {
  Bill as BillModel,
  BillItem as BillItemModel,
  Product as ProductModel,
} from "@/generated/prisma/client";
import { calculateBillTotals } from "@/lib/billing";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import type { Bill, BillItemDto, BillResponse } from "@/features/bills/types";

type BillWithItems = BillModel & { items: (BillItemModel & { product: ProductModel })[] };

/** Maps a Prisma `Bill` row (with its items + their products) to the plain wire shape the client expects. */
export const toBillDto = (bill: BillWithItems): Bill => {
  const items: BillItemDto[] = bill.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    unit: item.product.unit,
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toString(),
    lineTotal: item.lineTotal.toString(),
  }));
  const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal), 0);

  return {
    id: bill.id,
    customerName: bill.customerName,
    customerPhone: bill.customerPhone,
    customerId: bill.customerId,
    isCredit: bill.isCredit,
    subtotal: subtotal.toFixed(2),
    discount: bill.discount.toString(),
    taxAmount: bill.taxAmount.toString(),
    totalAmount: bill.totalAmount.toString(),
    createdAt: bill.createdAt.toISOString(),
    items,
  };
};

/** Raised for expected, user-facing bill-creation failures (bad product, insufficient stock). */
class BillValidationError extends Error {}

const CreateBillSchema = z
  .object({
    customerName: z.string().trim().optional(),
    customerPhone: z.string().trim().optional(),
    paymentMode: z.enum(["cash", "udhaar"], { error: "Please select a payment mode." }),
    discountType: z.enum(["flat", "percent"], { error: "Please select a discount type." }),
    discountValue: z.number().nonnegative({ error: "Discount can't be negative." }),
    items: z
      .array(
        z.object({
          productId: z.number().int().positive(),
          quantity: z.number().positive({ error: "Quantity must be greater than 0." }),
        })
      )
      .min(1, { error: "Add at least one product to the bill." }),
  })
  .refine((data) => data.paymentMode !== "udhaar" || !!data.customerPhone, {
    error: "Phone number is required for Udhaar bills.",
    path: ["customerPhone"],
  });

/**
 * Creates a bill: validates stock, computes discount/GST totals, looks up or
 * creates a Customer for Udhaar bills, then in one transaction writes the
 * Bill + BillItems, decrements each product's stock, and writes a `SOLD`
 * StockMovement per line item.
 * @param request - JSON body: `{ customerName?, customerPhone?, paymentMode,
 * discountType, discountValue, items: { productId, quantity }[] }`.
 */
export const POST = async (request: Request) => {
  await verifySession();

  const body = await request.json().catch(() => null);
  const validatedFields = CreateBillSchema.safeParse(body);

  if (!validatedFields.success) {
    return NextResponse.json(
      { error: validatedFields.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { customerName, customerPhone, paymentMode, discountType, discountValue, items } = validatedFields.data;

  try {
    const bill = await db.$transaction(async (tx) => {
      const productIds = items.map((item) => item.productId);
      const products = await tx.product.findMany({ where: { id: { in: productIds }, isActive: true } });

      if (products.length !== productIds.length) {
        throw new BillValidationError("One or more products are no longer available.");
      }

      const productsById = new Map(products.map((product) => [product.id, product]));
      const lineItems = items.map((item) => {
        // Guaranteed present — every id in productIds was just confirmed
        // against productsById via the length check above.
        const product = productsById.get(item.productId)!;

        if (Number(product.stock) < item.quantity) {
          throw new BillValidationError(`Not enough stock for ${product.name} — ${product.stock}${product.unit} available.`);
        }

        const unitPrice = Number(product.price);
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
        };
      });

      const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
      const totals = calculateBillTotals({ subtotal, discountType, discountValue });

      let customerId: number | undefined;
      if (paymentMode === "udhaar" && customerPhone) {
        const customer = await tx.customer.upsert({
          where: { phone: customerPhone },
          update: {},
          create: { name: customerName || "Unknown", phone: customerPhone },
        });
        customerId = customer.id;
      }

      const created = await tx.bill.create({
        data: {
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          customerId,
          isCredit: paymentMode === "udhaar",
          discount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          items: { create: lineItems },
        },
        include: { items: { include: { product: true } } },
      });

      for (const item of lineItems) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } });
        await tx.stockMovement.create({
          data: { productId: item.productId, type: "SOLD", quantity: item.quantity, billId: created.id },
        });
      }

      return created;
    });

    return NextResponse.json<BillResponse>({ bill: toBillDto(bill) }, { status: 201 });
  } catch (error) {
    if (error instanceof BillValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Something went wrong generating the bill." }, { status: 500 });
  }
};
