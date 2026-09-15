import { NextResponse } from "next/server";
import * as z from "zod";

import type { Product as ProductModel } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import { PRODUCT_UNITS, PRODUCT_STATUS_FILTERS } from "@/features/products/types";
import type { Product, ProductsResponse, CreateProductResponse } from "@/features/products/types";

/** Maps a Prisma `Product` row to the plain wire shape the client expects. */
export const toProductDto = (product: ProductModel): Product => ({
  id: product.id,
  name: product.name,
  price: product.price.toString(),
  unit: product.unit,
  stock: product.stock.toString(),
  isActive: product.isActive,
  createdAt: product.createdAt.toISOString(),
  updatedAt: product.updatedAt.toISOString(),
});

const CreateProductSchema = z.object({
  name: z.string().trim().min(1, { error: "Product name is required." }),
  price: z.number().positive({ error: "Price must be greater than 0." }),
  unit: z.enum(PRODUCT_UNITS, { error: "Please select a valid unit." }),
  initialStock: z.number().nonnegative({ error: "Initial stock can't be negative." }).optional(),
});

// Default page size for the product list — small enough to keep the table
// scannable on a phone screen, per the PRD's mobile-responsive note.
const DEFAULT_PAGE_SIZE = 10;

/**
 * Lists products, filtered by name/unit/active-state and paginated
 * server-side.
 * @param request - Query params: `search?`, `unit?`, `status?`
 * ("all"/"active"/"inactive", default "active"), `page?` (default 1),
 * `pageSize?` (default 10).
 */
export const GET = async (request: Request) => {
  await verifySession();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || undefined;
  const unitParam = searchParams.get("unit");
  const unit = unitParam && PRODUCT_UNITS.includes(unitParam as (typeof PRODUCT_UNITS)[number]) ? unitParam : undefined;
  const statusParam = searchParams.get("status");
  const status = PRODUCT_STATUS_FILTERS.includes(statusParam as (typeof PRODUCT_STATUS_FILTERS)[number])
    ? (statusParam as (typeof PRODUCT_STATUS_FILTERS)[number])
    : "active";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE);

  const where = {
    ...(search ? { name: { contains: search } } : {}),
    ...(unit ? { unit } : {}),
    ...(status === "all" ? {} : { isActive: status === "active" }),
  };

  try {
    const [products, totalCount] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { name: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json<ProductsResponse>({
      products: products.map(toProductDto),
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / pageSize)),
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong loading products." }, { status: 500 });
  }
};

/**
 * Creates a product. If `initialStock` is provided and greater than 0, also
 * writes a `RECEIVED` `StockMovement` row in the same transaction, so
 * StockMovement stays the single source of truth for every stock change.
 * @param request - JSON body: `{ name, price, unit, initialStock? }`.
 */
export const POST = async (request: Request) => {
  await verifySession();

  const body = await request.json().catch(() => null);
  const validatedFields = CreateProductSchema.safeParse(body);

  if (!validatedFields.success) {
    return NextResponse.json(
      { error: validatedFields.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { name, price, unit, initialStock } = validatedFields.data;

  try {
    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { name, price, unit, stock: initialStock ?? 0 },
      });

      if (initialStock && initialStock > 0) {
        await tx.stockMovement.create({
          data: { productId: created.id, type: "RECEIVED", quantity: initialStock },
        });
      }

      return created;
    });

    return NextResponse.json<CreateProductResponse>({ product: toProductDto(product) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Something went wrong creating the product." }, { status: 500 });
  }
};
