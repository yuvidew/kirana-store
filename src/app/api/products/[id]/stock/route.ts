import { NextResponse } from "next/server";
import * as z from "zod";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import type { AddProductStockResponse } from "@/features/products/types";
import { toProductDto } from "../../route";

const AddStockSchema = z.object({
  quantity: z.number().positive({ error: "Quantity must be greater than 0." }),
});

const parseId = (id: string) => {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
};

/**
 * Records received stock for a product: increments `Product.stock` and
 * writes a `RECEIVED` `StockMovement` row, in one transaction.
 * @param request - JSON body: `{ quantity }`.
 */
export const POST = async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await verifySession();

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid product id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const validatedFields = AddStockSchema.safeParse(body);

  if (!validatedFields.success) {
    return NextResponse.json(
      { error: validatedFields.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { quantity } = validatedFields.data;

  try {
    const product = await db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: { stock: { increment: quantity } },
      });
      await tx.stockMovement.create({
        data: { productId: id, type: "RECEIVED", quantity },
      });
      return updated;
    });

    return NextResponse.json<AddProductStockResponse>({ product: toProductDto(product) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Something went wrong adding stock." }, { status: 500 });
  }
};
