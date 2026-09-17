# Phase 3 — Bill Generation (PRD 2.4)

## Context

Phases 1 (Auth), 2 (base Product Management), and 2.5 (Product Management
Rework — category/costPrice/lowStockThreshold/expiryDate) are done and
merged. `plan-docs.md`'s Phase 3 is Bill Generation: a form to build a bill
from multiple product line items, apply a discount and GST, choose Cash or
Udhaar payment, save it (decrementing stock and writing `StockMovement`
rows), then view/print/share the result. `/billing` and `/bills/[id]`
currently exist only as a placeholder page and an empty `.gitkeep` folder
respectively — this phase fills both in for real, while the full Bills
List/History *table* (searching/filtering many past bills) stays Phase 5's
job, per `plan-docs.md`'s explicit phase split.

The existing `products` feature (`src/features/products/`) already has
everything Bill Generation needs to reuse: `useAllProducts()` for the
product search, `formatCurrency()` in `src/lib/utils.ts`, the shared
`LoadingCard`/`ErrorCard` (`src/components/query-state.tsx`), the
`Combobox` primitive (`src/components/ui/combobox.tsx`, installed but
unused so far), and the established Route Handler pattern (`verifySession()`
→ zod `safeParse` → `db.$transaction` → typed DTO mapper function exported
for reuse, e.g. `toProductDto` in `src/app/api/products/route.ts`, matched
here by a new `toBillDto` in `src/app/api/bills/route.ts`).

**Decisions locked in with the user:**
- **PDF export:** `@react-pdf/renderer` (a new dependency), not browser
  print-to-PDF — gives a real one-click "Download PDF" instead of the
  browser's print dialog. `plan-docs.md` explicitly left this open for
  Phase 3 to decide.
- **Barcode scanning:** out of scope. No `barcode` field added to
  `Product`. The product search `Combobox` is the only way to add a line
  item this phase; a scanner that emits keystrokes + Enter can still type
  into that search box, but there's no dedicated exact-code lookup.

Two schema decisions carried over from `plan-docs.md` §2 ("Prisma Schema
Additions"): `Bill` gains `customerId`/`isCredit`/`discount`/`taxAmount`
*now*, even though the full Udhaar/Khata ledger UI ships in Phase 7, so a
later migration isn't needed — this phase only needs the minimal
"look up or create a `Customer` by phone" behavior. `Customer.balance` and
`CustomerPayment` are **not** added yet — `plan-docs.md` explicitly defers
that decision to Phase 7, and nothing in Phase 3 reads a balance.

---

## Part A — Prisma schema + migration

Extend `prisma/schema.prisma`:

```prisma
model Customer {
  id        Int      @id @default(autoincrement())
  name      String
  phone     String   @unique
  createdAt DateTime @default(now())

  bills Bill[]
}

model Bill {
  id            Int      @id @default(autoincrement())
  customerName  String?
  customerPhone String?
  customerId    Int?
  isCredit      Boolean  @default(false)
  discount      Decimal  @default(0) @db.Decimal(10, 2)
  taxAmount     Decimal  @default(0) @db.Decimal(10, 2)
  totalAmount   Decimal  @db.Decimal(10, 2)
  createdAt     DateTime @default(now())

  customer       Customer?       @relation(fields: [customerId], references: [id])
  items          BillItem[]
  stockMovements StockMovement[]
}
```

`BillItem`/`StockMovement` are unchanged — `StockMovement.type` already has
`SOLD` in the enum from Phase 1, unused until now.

Run `npx prisma migrate dev --name add_billing_fields` by hand against the
local MySQL DB, same as the two prior migrations.

---

## Part B — Shared bill-math helper

**`src/lib/billing.ts`** (new) — a pure function with no Prisma import, so
it's safe to import from both a `'use client'` component (for the live
totals preview while building a bill) and a Route Handler (for the
authoritative calculation on save) without duplicating the discount/GST
math in two places:

```ts
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
```

Add `NEXT_PUBLIC_GST_RATE_PERCENT="5"` to `.env.example` and `.env.local`
(a single configurable rate, per `plan-docs.md` — `NEXT_PUBLIC_` so the
client-side live preview and the server route read the identical value).

---

## Part C — Route Handlers

### `src/app/api/bills/route.ts` (new)
Exports `toBillDto()` (mirrors `toProductDto`'s placement/export pattern
so `[id]/route.ts` can import it).

- `POST`: validates `{ customerName?, customerPhone?, paymentMode:
  "cash"|"udhaar", discountType: "flat"|"percent", discountValue: number,
  items: { productId: number, quantity: number }[] }` (zod; `items` min
  length 1; `.refine` that `customerPhone` is present when
  `paymentMode === "udhaar"`, matching the PRD's "phone number required
  when payment mode is Udhaar").
  - Inside `db.$transaction`:
    1. `tx.product.findMany({ where: { id: { in: productIds }, isActive: true } })` —
       if any requested id is missing, throw a local `BillValidationError`
       ("One or more products are no longer available.").
    2. For each line item, compare `Number(product.stock) < quantity` — if
       true, throw `BillValidationError` naming the product
       ("Not enough stock for Rice — 3kg available.").
    3. Compute `unitPrice`/`lineTotal` per item from the *current*
       `product.price` (never trust a client-supplied price — matches
       `BillItem`'s existing "snapshot price at sale time" design from
       Phase 1), sum to `subtotal`, run `calculateBillTotals()`.
    4. If `paymentMode === "udhaar"`: `tx.customer.upsert({ where: { phone:
       customerPhone }, update: {}, create: { name: customerName || "Unknown",
       phone: customerPhone } })` → `customerId`.
    5. `tx.bill.create({ data: { customerName, customerPhone, customerId,
       isCredit: paymentMode === "udhaar", discount: discountAmount,
       taxAmount, totalAmount, items: { create: lineItems } }, include: {
       items: { include: { product: true } } } })` — the `include` here
       returns everything `toBillDto` needs in one call.
    6. For each line item: `tx.product.update({ data: { stock: { decrement:
       quantity } } })` + `tx.stockMovement.create({ data: { productId,
       type: "SOLD", quantity, billId: bill.id } })`.
  - `catch`: `BillValidationError` → 400 with its message; anything else →
    500 generic (same shape as every other route).
  - Return `{ bill: toBillDto(bill) }`, 201.

### `src/app/api/bills/[id]/route.ts` (new, replaces the `.gitkeep`)
- `GET`: async `params`, `Number(id)` NaN guard (400, matching
  `parseId()` in `products/[id]/stock/route.ts`). `db.bill.findUnique({
  where: { id }, include: { items: { include: { product: true } } } })`,
  404 `{ error: "Bill not found." }` if null. Return `{ bill: toBillDto(bill) }`.

---

## Part D — `src/features/bills/` (view a generated bill)

This is the canonical "Bill" resource — its type, fetch-one hook, and the
receipt/print/share UI. The full searchable Bills List table is Phase 5;
this phase only needs to display *one* bill right after it's created.

- **`types.ts`**: `BillItemDto = { id, productId, productName, unit,
  quantity: string, unitPrice: string, lineTotal: string }`,
  `Bill = { id, customerName, customerPhone, customerId, isCredit,
  discount: string, taxAmount: string, totalAmount: string, subtotal:
  string, createdAt, items: BillItemDto[] }` (`subtotal` is a derived
  field the DTO mapper computes, not a DB column — convenience for the
  receipt view), `BillResponse = { bill: Bill }`.
- **`api/index.ts`**: `getBill(id: number)`.
- **`hook/use-bills.ts`**: `useBill(id: number)` — query key `["bill", id]`.
- **`_components/bill-receipt-view.tsx`** — `'use client'`. Owns
  `useBill(id)`, renders `LoadingCard`/`ErrorCard` for loading/error
  states (reused, not reinvented), then the bill header (id, date via
  `date-fns`), customer block, a line-items `Table`, and a totals summary
  (`formatCurrency` for every money value, reused from `src/lib/utils.ts`).
  Two actions:
  - **Download PDF**: `next/dynamic`'s `PDFDownloadLink` from
    `@react-pdf/renderer`, imported with `{ ssr: false }` — confirmed safe
    here since `ssr: false` is only disallowed in *Server* Components, and
    this file is already `'use client'`
    (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`).
  - **Share on WhatsApp**: builds a `wa.me/<phone>?text=<encoded summary>`
    link (falls back to `wa.me/?text=...` with no number when
    `customerPhone` is empty, opening WhatsApp's contact picker instead),
    `target="_blank"`.
- **`_components/bill-pdf-document.tsx`** — the `@react-pdf/renderer`
  `Document`/`Page`/`View`/`Text`/`StyleSheet` definition for the invoice
  layout (its own renderer, not regular DOM JSX).
- **`src/app/(protected)/bills/[id]/page.tsx`** (replaces the `.gitkeep`)
  — thin Server Component: `verifySession()` not needed here (already
  enforced by `(protected)/layout.tsx`), reads the route param, renders
  `<BillReceiptView id={...} />`.

`npm install @react-pdf/renderer`.

---

## Part E — `src/features/billing/` (the bill-creation form)

- **`types.ts`**: `PAYMENT_MODES = ["cash", "udhaar"] as const`,
  `DISCOUNT_TYPES = ["flat", "percent"] as const`,
  `BillLineItemInput = { productId: number; quantity: number }`,
  `CreateBillInput = { customerName?: string; customerPhone?: string;
  paymentMode: (typeof PAYMENT_MODES)[number]; discountType: (typeof
  DISCOUNT_TYPES)[number]; discountValue: number; items:
  BillLineItemInput[] }`, `CreateBillResponse = { bill: Bill }` (`Bill`
  imported from `@/features/bills/types` — the created resource's shape
  belongs with the feature that displays it, `billing` just returns it;
  same reuse-over-duplication reasoning as sharing `calculateBillTotals`).
- **`api/index.ts`**: `createBill(input: CreateBillInput)`.
- **`hook/use-billing.ts`**: local `getErrorMessage` helper (copied, per
  convention). `useCreateBill()` — mutation key `["create-bill"]`,
  `onSuccess` invalidates `["all-products"]` (stock changed) and toasts;
  no bill-list query to invalidate yet (Phase 5).
- **`_components/product-picker.tsx`** — `Combobox`/`ComboboxInput`/
  `ComboboxContent`/`ComboboxList`/`ComboboxItem` (`src/components/ui/combobox.tsx`)
  wired to `useAllProducts({ status: "active", pageSize: 20, search:
  debouncedQuery })` (reused from `src/features/products/hook/use-products.ts`
  — same 300ms-debounce pattern as `products-view.tsx`). On select, calls
  an `onAdd(product)` prop.
- **`_components/bill-line-items-table.tsx`** — `Table` of current line
  items: product name, unit, price, quantity (+/- stepper via
  `InputGroup`, same pattern as `product-form-dialog.tsx`'s
  `initialStock` control), line total (`formatCurrency`), remove button.
- **`_components/bill-summary-card.tsx`** — customer name/phone `Input`s
  (phone `required` when payment mode is Udhaar), payment mode `Select`
  (Cash/Udhaar), discount type `Select` (flat ₹ / percent %) + value
  `Input`, and the read-only subtotal/discount/tax/total breakdown driven
  by `calculateBillTotals()` (`useMemo` over line items + discount state).
- **`_components/billing-view.tsx`** — page composition. Owns line-items
  state (adding a product already in the list increments its quantity
  instead of duplicating a row — keeps productIds unique per the server's
  expectations), customer/payment/discount state. Renders `ProductPicker`
  + `BillLineItemsTable` + `BillSummaryCard` + a "Generate bill" `Button`
  (disabled when there are no line items or while `useCreateBill().isPending`).
  On success: `router.push(\`/bills/${bill.id}\`)`.
- **`src/app/(protected)/billing/page.tsx`** (replace the Phase 3
  placeholder) — thin wrapper rendering `<BillingView />`.

---

## Sequencing
1. Part A (schema + migration) — everything depends on the new columns/`Customer` table.
2. Part B (`src/lib/billing.ts`) — needed by both C and E.
3. Part C (Route Handlers) — `toBillDto` first, then `POST`, then `GET /[id]`.
4. Part D (`features/bills`) — `Bill` type is imported by Part E.
5. Part E (`features/billing`) — the form; last because it depends on D's `Bill` type and calls the Part C `POST` route.

## Verification
1. `npx prisma migrate dev --name add_billing_fields`; confirm the `Customer`
   table and `Bill`'s new columns exist. `npm install @react-pdf/renderer`.
2. `npm run dev`, log in, go to `/billing`. Add 2–3 products via the
   picker, adjust quantities — confirm the live subtotal/tax/total match a
   manual calculation at `GST_RATE_PERCENT`.
3. Toggle discount type flat ↔ percent, confirm the total updates
   correctly both ways.
4. **Cash bill**: leave phone blank, submit → succeeds, redirects to
   `/bills/[id]`. Via `npx prisma studio`, confirm each `Product.stock`
   decremented by exactly the billed quantity and a `SOLD` `StockMovement`
   row exists per line item with the new bill's `billId`.
5. **Udhaar bill**: submit with phone blank → blocked with a validation
   toast/error, no request sent. Fill name + phone, submit → succeeds;
   confirm a `Customer` row was created (or reused, if you bill the same
   phone again) and the `Bill` row has `isCredit: true` + a matching
   `customerId`.
6. Try to bill a quantity greater than a product's current stock → 400
   surfaced as an error toast, and confirm via Prisma Studio that no
   partial `Bill`/`BillItem`/`StockMovement` rows were written (the
   transaction rolled back).
7. On the resulting `/bills/[id]` page: "Download PDF" produces a file
   whose contents match the on-screen items/totals; "Share on WhatsApp"
   opens a `wa.me` link prefilled with a bill summary (and the customer's
   number, when one was entered).
8. Reload `/bills/<id>` directly in a fresh tab → same data renders
   (proves the `GET` route works standalone, not just the POST response).
9. Clear the session cookie and hit `POST /api/bills` / `GET
   /api/bills/1` directly → confirm `verifySession()` blocks both.
10. `npx tsc --noEmit` clean across the new/changed files.
