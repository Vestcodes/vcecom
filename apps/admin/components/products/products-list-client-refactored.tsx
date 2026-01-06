"use client";

import { Edit, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type Column,
  DataTable,
  type RowAction,
} from "@/components/common/data-table";
import { QueryState } from "@/components/common/query-state";
import { ListLayout } from "@/components/layout/list-layout";
import { ProductsTableSkeleton } from "@/components/skeletons/products-table-skeleton";
import { Badge } from "@/components/ui/badge";
import { useAdminDeleteProduct } from "@/hooks/products/use-admin-delete-product";
import { useAdminProducts } from "@/hooks/products/use-admin-products";
import { usePagination } from "@/hooks/use-pagination";
import {
  PRODUCT_DEFAULT_LIMIT,
  PRODUCT_DEFAULT_PAGE,
  PRODUCT_DEFAULT_SORT_BY,
  PRODUCT_DEFAULT_SORT_ORDER,
  PRODUCT_DELETE_CONFIRMATION_MESSAGE,
} from "@/lib/constants/products.constants";
import type { FilterDefinition } from "@/lib/types/filters";
import type { Product, ProductQueryParams } from "@/lib/types/products";
import { formatCurrency } from "@/lib/utils";
import { PaginationControls } from "../common/pagination-controls";
import { CreateProductSheet } from "./create-product-sheet";
import { EmptyProductsState } from "./empty-products-state";

/**
 * Refactored Products List Client using universal components
 */
export function ProductsListClientRefactored() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deleteProductMutation = useAdminDeleteProduct();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  const initialFilters = parseFiltersFromSearchParams(searchParams);
  const [productFilters, setProductFilters] =
    useState<ProductQueryParams>(initialFilters);

  const {
    data: productsData,
    isLoading,
    error,
  } = useAdminProducts(productFilters);

  useSyncFiltersToUrl(productFilters, router);

  const handlePageChange = useCallback((newPage: number) => {
    setProductFilters((prev) => ({ ...prev, page: newPage }));
  }, []);

  const pagination = usePagination(productsData, handlePageChange);

  const handleDeleteProduct = useCallback(
    async (productId: string) => {
      if (confirm(PRODUCT_DELETE_CONFIRMATION_MESSAGE)) {
        await deleteProductMutation.mutateAsync(productId);
      }
    },
    [deleteProductMutation],
  );

  const handleClearFilters = useCallback(() => {
    setProductFilters({
      page: PRODUCT_DEFAULT_PAGE,
      limit: PRODUCT_DEFAULT_LIMIT,
      sortBy: PRODUCT_DEFAULT_SORT_BY,
      sortOrder: PRODUCT_DEFAULT_SORT_ORDER,
    });
  }, []);

  // Convert products to table format
  const columns: Column<Product>[] = [
    {
      id: "image",
      header: "Image",
      width: "80px",
      cell: (product) => (
        <div className="h-10 w-10 rounded border border-border/50 overflow-hidden">
          {product.thumbnailUrl ? (
            <Image
              src={product.thumbnailUrl}
              alt={product.title}
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center text-xs text-muted-foreground">
              No Image
            </div>
          )}
        </div>
      ),
    },
    {
      id: "title",
      header: "Product",
      accessorKey: "title",
      sortable: true,
      cell: (product) => (
        <div>
          <div className="font-medium">{product.title}</div>
          {product.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">
              {product.description}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (product) => (
        <Badge
          variant={
            product.status === "active"
              ? "default"
              : product.status === "draft"
                ? "secondary"
                : "outline"
          }
        >
          {product.status}
        </Badge>
      ),
    },
    {
      id: "price",
      header: "Price",
      sortable: true,
      cell: (product) => formatCurrency(product.price),
    },
    {
      id: "updatedAt",
      header: "Updated",
      sortable: true,
      cell: (product) => new Date(product.updatedAt).toLocaleDateString(),
    },
  ];

  const rowActions: RowAction<Product>[] = [
    {
      label: "Edit",
      icon: <Edit className="h-4 w-4" />,
      onClick: (product) => router.push(`/products/${product.id}`),
    },
    {
      label: "Delete",
      icon: <Trash2 className="h-4 w-4" />,
      onClick: (product) => handleDeleteProduct(product.id),
      destructive: true,
    },
  ];

  // Filter definitions for filter drawer
  const filterDefinitions: FilterDefinition[] = [
    {
      key: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "all", label: "All Statuses" },
        { value: "draft", label: "Draft" },
        { value: "active", label: "Active" },
        { value: "archived", label: "Archived" },
      ],
    },
    {
      key: "inStock",
      label: "Stock Status",
      type: "boolean",
    },
    {
      key: "price",
      label: "Price Range",
      type: "range",
    },
  ];

  const filterValues = {
    status: productFilters.status,
    inStock: productFilters.inStock,
    price: {
      min: productFilters.minPrice,
      max: productFilters.maxPrice,
    },
  };

  const handleFiltersChange = (filters: Record<string, unknown>) => {
    setProductFilters((prev) => ({
      ...prev,
      status: filters.status as ProductQueryParams["status"],
      inStock: filters.inStock as boolean | undefined,
      minPrice: (filters.price as { min?: number; max?: number })?.min,
      maxPrice: (filters.price as { min?: number; max?: number })?.max,
      page: PRODUCT_DEFAULT_PAGE,
    }));
  };

  return (
    <>
      <ListLayout
        title="Products"
        description="Manage your product catalog"
        searchPlaceholder="Search products..."
        searchValue={productFilters.search || ""}
        onSearchChange={(value) =>
          setProductFilters((prev) => ({
            ...prev,
            search: value || undefined,
            page: PRODUCT_DEFAULT_PAGE,
          }))
        }
        createButtonLabel="Create Product"
        onCreateClick={() => setCreateSheetOpen(true)}
        filters={filterDefinitions}
        filterValues={filterValues}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        pagination={
          <PaginationControls
            paginationInfo={pagination.paginationInfo}
            onPreviousPage={pagination.handlePreviousPage}
            onNextPage={pagination.handleNextPage}
            canGoPrevious={pagination.canGoPrevious}
            canGoNext={pagination.canGoNext}
            isLoading={isLoading}
            itemLabel="products"
          />
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          data={productsData}
          loadingComponent={<ProductsTableSkeleton />}
          emptyComponent={<EmptyProductsState />}
          onRetry={() => window.location.reload()}
        >
          <DataTable<Product>
            columns={columns}
            data={productsData?.data || []}
            rowActions={rowActions}
            onRowClick={(product) => router.push(`/products/${product.id}`)}
            emptyMessage="No products found"
            isLoading={isLoading}
          />
        </QueryState>
      </ListLayout>

      <CreateProductSheet
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
      />
    </>
  );
}

/**
 * Parses search parameters from URL into ProductQueryParams
 */
function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): ProductQueryParams {
  return {
    page: parseInt(
      searchParams.get("page") || String(PRODUCT_DEFAULT_PAGE),
      10,
    ),
    limit: parseInt(
      searchParams.get("limit") || String(PRODUCT_DEFAULT_LIMIT),
      10,
    ),
    status:
      (searchParams.get("status") as ProductQueryParams["status"]) || undefined,
    search: searchParams.get("search") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    minPrice: (() => {
      const minPriceParam = searchParams.get("minPrice");
      return minPriceParam ? parseFloat(minPriceParam) : undefined;
    })(),
    maxPrice: (() => {
      const maxPriceParam = searchParams.get("maxPrice");
      return maxPriceParam ? parseFloat(maxPriceParam) : undefined;
    })(),
    inStock:
      searchParams.get("inStock") === "true"
        ? true
        : searchParams.get("inStock") === "false"
          ? false
          : undefined,
    sortBy:
      (searchParams.get("sortBy") as ProductQueryParams["sortBy"]) ||
      PRODUCT_DEFAULT_SORT_BY,
    sortOrder:
      (searchParams.get("sortOrder") as "asc" | "desc") ||
      PRODUCT_DEFAULT_SORT_ORDER,
  };
}

/**
 * Hook to sync product filters to URL when they change
 */
function useSyncFiltersToUrl(
  filters: ProductQueryParams,
  router: ReturnType<typeof useRouter>,
) {
  useEffect(() => {
    const urlParams = new URLSearchParams();

    if (filters.page && filters.page > PRODUCT_DEFAULT_PAGE) {
      urlParams.set("page", filters.page.toString());
    }
    if (filters.limit && filters.limit !== PRODUCT_DEFAULT_LIMIT) {
      urlParams.set("limit", filters.limit.toString());
    }
    if (filters.status) urlParams.set("status", filters.status);
    if (filters.search) urlParams.set("search", filters.search);
    if (filters.categoryId) urlParams.set("categoryId", filters.categoryId);
    if (filters.minPrice !== undefined) {
      urlParams.set("minPrice", filters.minPrice.toString());
    }
    if (filters.maxPrice !== undefined) {
      urlParams.set("maxPrice", filters.maxPrice.toString());
    }
    if (filters.inStock !== undefined) {
      urlParams.set("inStock", filters.inStock.toString());
    }
    if (filters.sortBy) urlParams.set("sortBy", filters.sortBy);
    if (filters.sortOrder) urlParams.set("sortOrder", filters.sortOrder);

    router.replace(`/products?${urlParams.toString()}`, { scroll: false });
  }, [filters, router]);
}
