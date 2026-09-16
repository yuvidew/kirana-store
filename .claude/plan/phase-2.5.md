# Phase 2.5 — Product Management Rework

## Context

`plan-docs.md`'s Phase 2.5 (added when `intro.md`/`plan-docs.md` were
expanded to follow guide sections A–F) requires four new fields on
`Product` — `category`, `costPrice`, `expiryDate`, `lowStockThreshold` —
plus UI to add/edit them and a low-stock badge in the product table. Phase 2
(base Product CRUD) is already built and merged; this phase extends it
in place rather than adding a new feature folder.

`src/app/api/products/route.ts`'s `toProductDto()` is the single DTO
mapper shared by all three product route files — extending it there is
enough to flow the new fields through create, update, and the stock
endpoint automatically.

Only `Product` is touched. `Bill`/`BillItem`/`StockMovement`/auth are
untouched — this phase's whole job is unblocking Phase 3 (GST/discount
pricing needs `costPrice` to exist), Phase 4 (Dashboard's low-stock tile),
and Phase 9 (Profit & Loss needs `costPrice`).

**Decisions made while planning:**
- `category` and `costPrice` become DB-required (`NOT NULL`) going forward,
  but get schema-level defaults (`""` / `0`) so the migration doesn't fail
  or interactively prompt against whatever rows already exist locally —
  zod enforces "actually required" for all new writes at the API layer.
- `lowStockThreshold` and `expiryDate` are nullable/optional — matches the
  PRD calling `expiryDate` optional-per-product, and lets a store owner
  skip setting a threshold for items they don't want alerts on.
- No existing date-picker exists anywhere in this app (confirmed via
  search) — building one is in scope for this phase (see Part D).
- Cost price is edit-dialog-only, **not** added as a `ProductTable` column
  — keeps the table's 6 columns from growing to 8 on a page that must stay
  mobile-scannable per the PRD's design notes. Category *is* added as a
  column (guide explicitly lists it as a grouping/filter field).
- Category filtering reuses the existing `search` box (broadened to match
  `name` OR `category`) instead of adding a second filter dropdown + a
  new "distinct categories" endpoint — simpler, and categories are
  free-text rather than a fixed enum like `unit`, so a dropdown would need
  its own data source.

---

## Part A — Prisma schema + migration

**`prisma/schema.prisma`** — extend `Product`:
```prisma
model Product {
  id                Int       @id @default(autoincrement())
  name              String
  category          String    @default("")
  price             Decimal   @db.Decimal(10, 2)
  costPrice         Decimal   @default(0) @db.Decimal(10, 2)
  unit              String
  stock             Decimal   @default(0) @db.Decimal(10, 2)
  lowStockThreshold Decimal?  @db.Decimal(10, 2)
  expiryDate        DateTime?
  isActive          Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  billItems      BillItem[]
  stockMovements StockMovement[]
}
```
Run `npx prisma migrate dev --name add_product_fields` by hand against the
local MySQL DB (matches how the existing `20260915090906_init` migration
was created — there's no npm script for this). The `@default` values mean
the migration applies cleanly with no interactive prompt even if local test
rows already exist.

---

## Part B — `src/features/products/types.ts`

Extend `Product`:
```ts
export type Product = {
  id: number;
  name: string;
  category: string;
  price: string;
  costPrice: string;
  unit: string;
  stock: string;
  lowStockThreshold: string | null;
  expiryDate: string | null; // ISO date string, null when unset
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
```
Extend `CreateProductInput` (`category: string`, `costPrice: number`,
`lowStockThreshold?: number`, `expiryDate?: string`) and `UpdateProductInput`
(same four, minus `initialStock` which isn't part of update today either).
No changes needed to `Deactivate*`/`AddProductStock*` types.

---

## Part C — Route Handlers

**`src/app/api/products/route.ts`**
- `toProductDto`: add `category: product.category`, `costPrice:
  product.costPrice.toString()`, `lowStockThreshold:
  product.lowStockThreshold?.toString() ?? null`, `expiryDate:
  product.expiryDate?.toISOString() ?? null`.
- `CreateProductSchema`: add `category: z.string().trim().min(1, { error:
  "Category is required." })`, `costPrice: z.number().nonnegative({ error:
  "Cost price can't be negative." })`, `lowStockThreshold:
  z.number().nonnegative().optional()`, `expiryDate:
  z.string().optional()` (parsed with `new Date(...)` before the Prisma
  call, not passed raw).
- `POST`: pass `category`, `costPrice`, `lowStockThreshold`,
  `expiryDate: expiryDate ? new Date(expiryDate) : undefined` into
  `tx.product.create({ data: {...} })`.
- `GET`: broaden the `search` clause from `{ name: { contains: search } }`
  to `{ OR: [{ name: { contains: search } }, { category: { contains:
  search } }] }`, so the existing search box also matches category —
  no new query param needed.

**`src/app/api/products/[id]/route.ts`**
- `UpdateProductSchema`: same four additions as `CreateProductSchema`
  (minus any create-only concept — there isn't one here since `initialStock`
  was never part of update).
- `PATCH`: pass the four new fields through to `db.product.update({ data:
  { ...validatedFields.data, expiryDate: ... ? new Date(...) : null } })`.
  Explicit `null` (not `undefined`) when clearing `expiryDate` on edit, so
  a previously-set expiry date can be removed via the form.

**`src/app/api/products/[id]/stock/route.ts`** — no changes. It already
returns `toProductDto(updated)`, which will include the new fields
automatically once Part C's `toProductDto` change lands.

**`src/features/products/api/index.ts`** and **`hook/use-products.ts`** —
no changes needed. Both are generic over whatever shape `CreateProductInput`
/`UpdateProductInput` are; they don't reference individual field names.

---

## Part D — UI

### D1. New: a single-date picker component
No date-picker exists anywhere in this app yet (confirmed by searching
`src/features/` and `src/components/` for `Calendar`/`Combobox` usage —
zero hits). `src/components/ui/calendar.tsx` (wraps `react-day-picker`,
already installed) and `popover.tsx` are both present but unused.

First try `npx shadcn add date-picker` (this project's `base-vega` preset
registry may include one). If that registry entry doesn't exist, hand-build
`src/components/date-picker.tsx` (in `src/components/`, not
`src/components/ui/` — it's app-composed, not a generated shadcn
primitive, so it's fine to hand-write per `CLAUDE.md`'s reuse-over-
duplication guidance):
```tsx
/**
 * A button that opens a calendar popover to pick a single date.
 * @param date - The currently selected date, or undefined.
 * @param onDateChange - Called with the newly picked date (or undefined if cleared).
 * @param placeholder - Button text shown when no date is selected.
 */
export const DatePicker = ({ date, onDateChange, placeholder = "Pick a date" }: {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
}) => {
  // Popover + Calendar(mode="single"), Button as PopoverTrigger showing
  // format(date, "PPP") via date-fns (already installed) or the placeholder.
};
```
Built once here, but reusable later (e.g. a date-range variant for Reports'
Phase 6 date picker, though that's out of scope for this phase).

### D2. `product-form-dialog.tsx`
Add four fields to `FieldGroup`, following the file's existing per-field
pattern (plain `Input` + `FormData` for text/number fields, lifted
`useState` for anything not natively `FormData`-compatible — same reasoning
already used for `unit` and `initialStock`):
- **Category** — plain `Input` (`name="category"`, `defaultValue=
  {product?.category}`, required), read via `FormData` exactly like `name`.
- **Cost price (₹)** — plain numeric `Input` (`name="costPrice"`, `type=
  "number"`, `step="0.01"`, `min="0"`, `defaultValue={product?.costPrice}`,
  required), read via `FormData` exactly like `price`.
- **Low-stock threshold (optional)** — plain numeric `Input` (`name=
  "lowStockThreshold"`, `type="number"`, `step="0.01"`, `min="0"`,
  `defaultValue={product?.lowStockThreshold ?? ""}`), read via `FormData`
  with blank → `undefined` (`const raw = formData.get("lowStockThreshold");
  const lowStockThreshold = raw ? Number(raw) : undefined`).
- **Expiry date (optional)** — the new `DatePicker`, lifted into `useState<
  Date | undefined>(product?.expiryDate ? new Date(product.expiryDate) :
  undefined)`, same pattern as the existing `unit` state. On submit:
  `expiryDate: expiryDate?.toISOString()`.

`handleSubmit` passes all four through to both the create and update
mutation calls alongside the existing `name`/`price`/`unit`.

### D3. `product-table.tsx`
- Add a **Category** column (plain text cell) between Name and Unit.
- Stock cell: when `product.lowStockThreshold != null && Number(product.
  stock) <= Number(product.lowStockThreshold)`, render a `Badge
  variant="destructive"` reading "Low stock" next to the stock number
  (reuses the existing `Badge` primitive — no new variant needed).
- No cost-price column (see the Context decision above).

### D4. `products-view.tsx`
No structural changes — the existing `search` input already becomes
category-aware once Part C's `GET` change lands, since it's the same
query param just matching a broader `where` clause server-side.

---

## Sequencing
1. Part A (schema + migration) first — everything else depends on the new
   columns existing and the regenerated Prisma client/types.
2. Part B (`types.ts`) — shared contract for both routes and UI.
3. Part C (Route Handlers) — `toProductDto` first (shared by all three
   route files), then the two zod schemas, then the `GET` search change.
4. Part D1 (date-picker) before D2, since the form dialog depends on it.
5. Part D2 → D3 → D4.

## Verification
1. `npx prisma migrate dev --name add_product_fields`, confirm it applies
   without prompting (schema defaults should prevent that) and the
   generated client in `src/generated/prisma/` picks up the new fields.
2. `npm run dev`, log in, go to `/products`.
3. Add a new product with category, cost price, a low-stock threshold
   above the entered initial stock, and an expiry date → row appears,
   shows the category, shows a "Low stock" badge (since stock ≤
   threshold), toast fires.
4. Edit that product: change category/cost price/threshold, clear the
   expiry date → changes persist on reload; clearing expiry actually nulls
   it (not left stale).
5. Use "Add stock" to push stock above the threshold → badge disappears
   without a page reload (query invalidation already wired).
6. Search box: typing a category name (not a product name) still filters
   the list correctly.
7. Any product row that existed before the migration still renders without
   crashing (empty category, ₹0.00 cost price, no badge since
   `lowStockThreshold` is `null`).
8. `npx tsc --noEmit` across the whole repo.
