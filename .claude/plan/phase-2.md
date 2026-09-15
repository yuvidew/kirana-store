# Phase 2 — Sidebar Shell + Product Management

## Context

Phase 1 (auth) is done: login/logout, `verifySession()`, session cookies, and
`proxy.ts` route protection all work. The app currently has no navigation —
`(protected)/layout.tsx` is just a bare header with a logout button, and only
`/dashboard` has a real (placeholder) page; `/products`, `/billing`,
`/bills`, `/reports` are empty route folders that 404.

This phase does two things together because the user wants to see the app's
real shape before going deeper into any one feature:

1. **Sidebar navigation** (shadcn's `sidebar` primitive, already installed)
   linking Dashboard / Products / Billing / Bills / Reports, so the app is
   navigable end-to-end. Billing/Bills/Reports get placeholder pages (same
   style as the existing Dashboard placeholder) purely so their links
   resolve — their real implementations are later phases.
2. **Product Management** (PRD 2.3 / plan-docs.md Phase 2) — the first real
   CRUD feature: add/edit/deactivate products, add received stock, and a
   searchable product list. This is built before Bill Generation and
   Dashboard because both depend on product data existing.

`prisma/schema.prisma` already has `Product`, `Bill`, `BillItem`, and
`StockMovement` models — no migration work needed this phase, only the
feature layer on top of the existing schema.

As requested, this plan file's content will also be copied to
`.claude/plan/phase-2.md` in the repo as the first implementation step, so
it's checked into the project alongside the code it describes.

## Part A — Sidebar Shell

**`src/components/layout/app-sidebar.tsx`** (new) — client component.
- `NAV_ITEMS` const: Dashboard (`/dashboard`, `LayoutDashboardIcon`),
  Products (`/products`, `PackageIcon`), Billing (`/billing`,
  `ReceiptTextIcon`), Bills (`/bills`, `FileTextIcon`), Reports (`/reports`,
  `BarChart3Icon`) — all from `lucide-react`.
- `SidebarHeader` shows "Kirana Store". `SidebarContent` → `SidebarGroup` →
  `SidebarMenu` → one `SidebarMenuItem`/`SidebarMenuButton` per nav item.
- Active state via `usePathname()`: `pathname === item.url ||
  pathname.startsWith(item.url + "/")` (same prefix logic as `proxy.ts`'s
  protected-routes check, kept consistent).
- `SidebarMenuButton` in this codebase's shadcn build takes a `render` prop
  (Base UI `useRender` pattern, confirmed by reading
  `src/components/ui/sidebar.tsx:499-528`), not `asChild`. Usage:
  `<SidebarMenuButton render={<Link href={item.url} />} isActive={isActive} tooltip={item.title}>`
  with the icon + label as children.
- `SidebarFooter` renders `<LogoutButton />` (moved here from the old
  header). Include `<SidebarRail />` inside `<Sidebar>` per standard shadcn
  sidebar composition.

**`src/app/(protected)/layout.tsx`** (modify) — wrap in
`SidebarProvider`/`AppSidebar`/`SidebarInset`, with a slim top header
containing just `SidebarTrigger` + the "Kirana Store" label (title now also
appears in the sidebar header, that's fine — the top bar keeps the trigger
visible when collapsed). Drop the old `flex min-h-svh flex-col` wrapper;
`SidebarProvider`/`SidebarInset` supply their own layout shell. Keep the
existing `await verifySession()` call at the top. No changes needed to
`proxy.ts` or `dal.ts`.

## Part B — Placeholder Pages

Three new files, each mirroring `src/app/(protected)/dashboard/page.tsx`
exactly (arrow function, one-line JSDoc naming the future phase, `p-6`
wrapper, `text-lg font-medium` heading, `text-sm text-muted-foreground`
subtext, `export default` on its own line):

- `src/app/(protected)/billing/page.tsx` — "Built in Phase 3"
- `src/app/(protected)/bills/page.tsx` — "Built in Phase 5" (the list page;
  the existing empty `bills/[id]/` folder stays untouched, out of scope)
- `src/app/(protected)/reports/page.tsx` — "Built in Phase 6"

## Part C — Product Management

Mirrors `src/features/auth/` exactly (the established reference pattern),
built bottom-up: types → Route Handlers → api → hooks → components.

### C1. `src/features/products/types.ts` (new)
- `PRODUCT_UNITS = ["kg", "g", "litre", "ml", "pcs"] as const` — single
  source of truth, imported by both the create/edit form's `Select` and the
  Route Handlers' zod schemas.
- `Product` type: `id: number`, `name: string`, `price: string`,
  `unit: string`, `stock: string`, `isActive: boolean`, `createdAt: string`,
  `updatedAt: string`. **`price`/`stock` are strings** — Prisma `Decimal`
  serializes as a string over JSON, and Route Handlers will map explicitly
  to this shape (`.toString()`) rather than relying on it implicitly, so
  the wire contract is explicit. UI converts with `Number(...)` only where
  needed for display/arithmetic.
- `ProductsResponse = { products: Product[] }`.
- `CreateProductInput = { name; price: number; unit: string; initialStock?: number }`,
  `CreateProductResponse = { product: Product }`.
- `UpdateProductInput = { id: number; name; price: number; unit: string }`,
  `UpdateProductResponse = { product: Product }`.
- `DeactivateProductInput = { id: number; productName?: string }` (name is
  client-side only, for the toast — never sent), `DeactivateProductResponse = { product: Product }`.
- `AddProductStockInput = { id: number; quantity: number; productName?: string }`,
  `AddProductStockResponse = { product: Product }`.

### C2. Route Handlers
All three files call `verifySession()` first, validate with `zod` (matching
`src/app/api/auth/login/route.ts`'s established style — `safeParse`, 400
with `{ error: message }` on failure), wrap the Prisma call in try/catch,
and map Prisma results to the plain `Product` DTO shape (Decimal →
`.toString()`, dates → `.toISOString()`). Put a small `toProductDto()`
helper in `src/app/api/products/route.ts` and import it into the other two
route files to avoid repeating the mapping three times.

- **`src/app/api/products/route.ts`**
  - `GET`: `db.product.findMany({ orderBy: { name: "asc" } })` → `{ products }`.
  - `POST`: validate `{ name, price, unit, initialStock? }` (unit via
    `z.enum(PRODUCT_UNITS)`). `db.$transaction`: create the `Product`
    (`stock: initialStock ?? 0`); if `initialStock > 0`, also create a
    `StockMovement` (`type: "RECEIVED"`) row in the same transaction, so
    `StockMovement` stays the single source of truth for every stock
    change including the initial one. Return `{ product }`, 201.

- **`src/app/api/products/[id]/route.ts`**
  - `PATCH`: async `params`, `Number(id)` with a NaN guard (400). Validate
    `{ name, price, unit }` (no stock field — stock only ever changes via
    the dedicated stock endpoint, to preserve the audit trail).
    `db.product.update(...)`; catch Prisma `P2025` → 404
    `{ error: "Product not found." }`. Return `{ product }`.
  - `DELETE`: soft delete — `db.product.update({ where: { id }, data: { isActive: false } })`.
    Same 404 handling. No request body. Return `{ product }`.

- **`src/app/api/products/[id]/stock/route.ts`**
  - `POST`: validate `{ quantity: z.number().positive() }`.
    `db.$transaction`: `product.update({ data: { stock: { increment: quantity } } })`
    + `stockMovement.create({ data: { productId, type: "RECEIVED", quantity } })`.
    404 on missing product. Return `{ product }`.

### C3. `src/features/products/api/index.ts` (new)
One axios function per endpoint, same pattern as `features/auth/api/index.ts`:
`allProducts`, `createProduct`, `updateProduct`, `deactivateProduct`,
`addProductStock` — each typed against the response type, returning
`data.product`/`data.products`.

### C4. `src/features/products/hook/use-products.ts` (new)
- Local `getErrorMessage(error, fallback)` helper (copied, not shared, per
  convention).
- `useAllProducts(options?: { refetchInterval?: number })` — query key
  `["all-products"]`.
- `useCreateProduct()`, `useUpdateProduct()`, `useDeactivateProduct()`,
  `useAddProductStock()` — mutation keys `["create-product"]` /
  `["update-product"]` / `["deactivate-product"]` / `["add-product-stock"]`.
  Every mutation's `onSuccess` invalidates `["all-products"]` (the only
  query key in this feature) and toasts via `toast.add(...)`;
  `onError` toasts via `getErrorMessage`. `useDeactivateProduct` and
  `useAddProductStock` read `productName`/`quantity` from the mutation
  variables (not the response) for their toast text, matching the
  `useDeleteProduct` pattern in CLAUDE.md.

### C5. `src/features/products/_components/` (new)
- **`products-view.tsx`** — page composition (`ProductsView`). Owns
  `useAllProducts()`, local `search`/`showInactive` state, client-side
  filter (`name` substring + active/inactive — no pagination needed at this
  scale, so no `keepPreviousData`), dialog open/target state for
  edit/add-stock/deactivate, an "Add product" button, and renders
  `ProductTable` + the three dialogs below. Empty state via the already-
  installed `Empty` component (`src/components/ui/empty.tsx`).
- **`product-table.tsx`** — shadcn `Table`; columns Name, Unit, Price
  (`₹${Number(price).toFixed(2)}`), Stock, Status (`Badge`), Actions
  (`DropdownMenu`: Edit / Add stock / Deactivate). Props: `products` +
  `onEdit`/`onAddStock`/`onDeactivate` callbacks.
- **`product-form-dialog.tsx`** — shared create/edit `Dialog`. `product`
  prop present → edit mode (name/price/unit only, calls
  `useUpdateProduct`); absent → create mode (adds optional initial-stock
  field, calls `useCreateProduct`). Built from `Field`/`FieldGroup`/
  `FieldLabel`/`FieldError`, `Input`, `Select` (options from
  `PRODUCT_UNITS`) — raw `FormData` on submit, matching `login-form.tsx`,
  not react-hook-form. Closes itself via the mutation's per-call
  `onSuccess`.
- **`add-stock-dialog.tsx`** — small `Dialog` with one quantity `Input`
  (`type="number"`, `step="0.01"`, `min="0.01"`), calls
  `useAddProductStock()`.
- **`deactivate-product-alert.tsx`** — confirmation using the already-
  installed `alert-dialog.tsx` primitives, controlled the same way as the
  other two dialogs (`open`/`onOpenChange`/`product` props), wired to
  `useDeactivateProduct()`.

### C6. `src/app/(protected)/products/page.tsx` (new)
Thin Server Component wrapper rendering `<ProductsView />` (the client
boundary lives inside the feature component, not the route file, per
convention).

### Small addition: currency formatting
No currency formatter exists yet in `src/lib/utils.ts`. Add a small
`formatCurrency(value: number | string)` helper there (→ `₹45.00`) since
Billing/Bills/Reports will all need the same formatting in later phases —
add it now rather than inlining `.toFixed()` logic in `product-table.tsx`.

## Sequencing
1. Sidebar (Part A) + placeholder pages (Part B) — unblocks navigation
   testing immediately, independent of Part C.
2. Part C bottom-up: `types.ts` → Route Handlers → `api/index.ts` →
   `hook/use-products.ts` → `_components/` → `products/page.tsx`.

## Verification
1. `npm run dev`, log in with existing admin credentials.
2. Sidebar renders on every protected page with all 5 links; Billing/Bills/
   Reports show their placeholder text; Products loads the real page.
   Active-link highlighting follows the current route.
3. `SidebarTrigger` and `Cmd/Ctrl+B` both collapse/expand the sidebar, and
   the collapsed state survives a reload (`sidebar_state` cookie).
4. On `/products`: add a product with initial stock > 0 → row appears,
   toast fires. Check `Product.stock` and confirm a `StockMovement`
   (`RECEIVED`) row was written with matching `productId`/`quantity` (via
   `npx prisma studio` or a quick script).
5. Edit the product (name/price/unit) → row updates, `Product.stock`
   unchanged, no new `StockMovement` row.
6. "Add stock" on a row → `Product.stock` increments by exactly the entered
   amount, a second `StockMovement` (`RECEIVED`) row appears.
7. Deactivate a product → disappears from the default list, `isActive`
   becomes `false` in DB (not deleted), reappears with an "Inactive" badge
   when "show inactive" is toggled on.
8. Search box filters by name substring, composes correctly with the
   active/inactive toggle.
9. Clear the session cookie and hit `/api/products` directly → confirm
   `verifySession()` blocks it (not just the `proxy.ts` redirect).
10. `npx tsc --noEmit` across the new files.
