import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { verifySession } from "@/lib/dal";
import type { BillResponse } from "@/features/bills/types";
import { toBillDto } from "../route";

const parseId = (id: string) => {
  const parsed = Number(id);
  return Number.isInteger(parsed) ? parsed : null;
};

/**
 * Fetches a single bill with its line items and their products, for the
 * receipt/print/share view.
 * @param request - Unused; present for the Route Handler signature.
 */
export const GET = async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  await verifySession();

  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ error: "Invalid bill id." }, { status: 400 });
  }

  try {
    const bill = await db.bill.findUnique({ where: { id }, include: { items: { include: { product: true } } } });

    if (!bill) {
      return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    }

    return NextResponse.json<BillResponse>({ bill: toBillDto(bill) });
  } catch {
    return NextResponse.json({ error: "Something went wrong loading the bill." }, { status: 500 });
  }
};
