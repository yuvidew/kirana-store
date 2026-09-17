"use client";

import { useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { formatCurrency } from "@/lib/utils";
import { useAllProducts } from "@/features/products/hook/use-products";
import type { Product } from "@/features/products/types";

// Delay before a search keystroke fires a request — same convention as
// products-view.tsx's search box.
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search-and-select combobox for adding a product line item to a bill.
 * Debounces the query into `useAllProducts`'s server-side search, then
 * resets itself after each pick so it's ready for the next product — this
 * is a one-shot "add to bill" action, not a persistent single-select.
 * @param onAdd - Called with the selected product.
 */
export const ProductPicker = ({ onAdd }: { onAdd: (product: Product) => void }) => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  const { data } = useAllProducts({ status: "active", pageSize: 20, search: debouncedQuery || undefined });
  const products = data?.products ?? [];

  return (
    <Combobox<Product>
      items={products}
      filteredItems={products}
      value={null}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(product) => product.name}
      onValueChange={(product) => {
        if (product) {
          onAdd(product);
          setQuery("");
        }
      }}
    >
      <ComboboxInput placeholder="Search products to add…" />
      <ComboboxContent>
        <ComboboxEmpty>No products found.</ComboboxEmpty>
        <ComboboxList>
          {products.map((product) => (
            <ComboboxItem key={product.id} value={product}>
              <SearchIcon className="text-muted-foreground" />
              <div className="flex flex-1 flex-col">
                <span>{product.name}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(product.price)} / {product.unit} · {product.stock} in stock
                </span>
              </div>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
};
