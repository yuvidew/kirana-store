/** Fixed unit options for a product, matching the PRD's kg/g/litre/ml/pcs set. */
export const PRODUCT_UNITS = ["kg", "g", "litre", "ml", "pcs"] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

// price/costPrice/stock/lowStockThreshold are Decimal fields on the server —
// they serialize to JSON as strings, so the client type reflects that
// instead of assuming `number`.
export type Product = {
  id: number;
  name: string;
  category: string;
  price: string;
  costPrice: string;
  unit: string;
  stock: string;
  lowStockThreshold: string | null;
  expiryDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Status filter for the product list — "all" applies no isActive filter. */
export const PRODUCT_STATUS_FILTERS = ["all", "active", "inactive"] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

export type ProductsQuery = {
  search?: string;
  unit?: string;
  status?: ProductStatusFilter;
  page?: number;
  pageSize?: number;
};

export type ProductsResponse = {
  products: Product[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type CreateProductInput = {
  name: string;
  category: string;
  price: number;
  costPrice: number;
  unit: string;
  initialStock?: number;
  lowStockThreshold?: number;
  expiryDate?: string;
};

export type CreateProductResponse = {
  product: Product;
};

export type UpdateProductInput = {
  id: number;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  unit: string;
  lowStockThreshold?: number;
  expiryDate?: string;
};

export type UpdateProductResponse = {
  product: Product;
};

export type DeactivateProductInput = {
  id: number;
  // Client-side only, used by the mutation's onSuccess toast — never sent.
  productName?: string;
};

export type DeactivateProductResponse = {
  product: Product;
};

export type AddProductStockInput = {
  id: number;
  quantity: number;
  productName?: string;
};

export type AddProductStockResponse = {
  product: Product;
};
