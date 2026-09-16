import { NextResponse } from "next/server";
import * as z from "zod";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { PRODUCT_UNITS } from "@/features/products/types";
import type { UpdateProductResponse, DeactivateProductResponse } from "@/features/products/types";
import { toProductDto } from "../route";

const UpdateProductSchema = z.object({
  name: z.string().trim().min(1, { error: "Product name is required." }),
  category: z.string().trim().min(1, { error: "Category is required." }),
  price: z.number().positive({ error: "Price must be greater than 0." }),
  costPrice: z.number().nonnegative({ error: "Cost price can't be negative." }),
  unit: z.enum(PRODUCT_UNITS, { error: "Please select a valid unit." }),
  lowStockThreshold: z.number().nonnegative({ error: "Low-stock threshold can't be negative." }).optional(),
  expiryDate: z.string().optional(),
});

const parseId = (id: string) => {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
};

/**
 * Updates a product's name/category/price/costPrice/unit/lowStockThreshold/
 * expiryDate. Stock is never touched here — it only changes via the
 * dedicated stock endpoint, to preserve the StockMovement audit trail.
 * @param request - JSON body: `{ name, category, price, costPrice, unit,
 * lowStockThreshold?, expiryDate? }`.
 */
export const PATCH = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await verifySession();

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const validatedFields = UpdateProductSchema.safeParse(body);

  if (!validatedFields.success) {
    return NextResponse.json(
      { error: validatedFields.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { expiryDate, ...rest } = validatedFields.data;

  try {
    const product = await db.product.update({
      where: { id },
      // Explicit null (not undefined) clears a previously-set expiry date
      // when the form's date picker is left empty on edit.
      data: { ...rest, expiryDate: expiryDate ? new Date(expiryDate) : null },
    });
    return NextResponse.json<UpdateProductResponse>({ product: toProductDto(product) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Something went wrong updating the product." }, { status: 500 });
  }
};

/** Soft-deletes a product by setting `isActive: false` (kept for referential integrity with Bills/StockMovements). */
export const DELETE = async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await verifySession();

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  try {
    const product = await db.product.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json<DeactivateProductResponse>({ product: toProductDto(product) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Something went wrong deactivating the product." }, { status: 500 });
  }
};
