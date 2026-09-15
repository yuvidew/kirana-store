"use client";

import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PackageIcon, PlusIcon } from "lucide-react";

import { ErrorCard, LoadingCard } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useAllProducts } from "../hook/use-products";
import { PRODUCT_STATUS_FILTERS, PRODUCT_UNITS } from "../types";
import type { Product, ProductStatusFilter } from "../types";
import { AddStockDialog } from "./add-stock-dialog";
import { DeactivateProductAlert } from "./deactivate-product-alert";
import { ProductFormDialog } from "./product-form-dialog";
import { ProductTable } from "./product-table";

const PAGE_SIZE = 10;
// Delay before a search keystroke fires a request, so typing doesn't
// trigger a round trip per character.
const SEARCH_DEBOUNCE_MS = 300;

const STATUS_FILTER_LABELS: Record<ProductStatusFilter, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
};

/**
 * Product management page: search/filter, table, and the add/edit/add-stock/
 * deactivate dialogs. Search, the active/inactive filter, and pagination are
 * all handled server-side via `useAllProducts`'s query params. Owns all
 * dialog open/target state and passes callbacks down to `ProductTable`'s
 * row actions.
 */
export const ProductsView = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("active");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);

  useEffect(() => {
    // Reset to page 1 alongside the debounced search value so a new search
    // doesn't leave the view stranded on a now out-of-range page.
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const handleUnitFilterChange = (value: string) => {
    setUnitFilter(value);
    setPage(1);
  };
  const handleStatusFilterChange = (value: ProductStatusFilter) => {
    setStatusFilter(value);
    setPage(1);
  };

  const { data, isLoading, isError, refetch } = useAllProducts({
    search: debouncedSearch || undefined,
    unit: unitFilter === "all" ? undefined : unitFilter,
    status: statusFilter,
    page,
    pageSize: PAGE_SIZE,
  });

  const products = data?.products ?? [];
  const totalPages = data?.totalPages ?? 1;
  const hasAnyResults = data ? data.totalCount > 0 : true;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-medium">Products</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <PlusIcon />
          Add product
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-xs"
        />
        <Select value={unitFilter} onValueChange={(value) => value && handleUnitFilterChange(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All units</SelectItem>
            {PRODUCT_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => value && handleStatusFilterChange(value as ProductStatusFilter)}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_STATUS_FILTERS.map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_FILTER_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingCard title="Loading products…" />
      ) : isError ? (
        <ErrorCard
          title="Couldn't load products"
          description="Something went wrong loading the product list."
          onRetry={() => refetch()}
        />
      ) : products.length === 0 ? (
        <Empty className="min-h-64">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageIcon />
            </EmptyMedia>
            <EmptyTitle>No products found</EmptyTitle>
            <EmptyDescription>
              {hasAnyResults ? "No products match your search." : "Add your first product to get started."}
            </EmptyDescription>
          </EmptyHeader>
          {!hasAnyResults && (
            <EmptyContent>
              <Button onClick={() => setIsCreateOpen(true)}>
                <PlusIcon />
                Add product
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <>
          <ProductTable
            products={products}
            onEdit={setEditingProduct}
            onAddStock={setStockTarget}
            onDeactivate={setDeactivateTarget}
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeftIcon />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </>
      )}

      <ProductFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <ProductFormDialog
        key={editingProduct?.id ?? "edit"}
        open={!!editingProduct}
        onOpenChange={(open) => !open && setEditingProduct(null)}
        product={editingProduct ?? undefined}
      />
      <AddStockDialog
        open={!!stockTarget}
        onOpenChange={(open) => !open && setStockTarget(null)}
        product={stockTarget}
      />
      <DeactivateProductAlert
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        product={deactivateTarget}
      />
    </div>
  );
};
