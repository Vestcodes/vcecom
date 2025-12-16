/**
 * API client for admin dashboard
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface AdminStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  averageOrderValue: number;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productVariantId: string;
  quantity: number;
  price: number; // Effective price at order time (sale or regular)
  wasOnSale?: boolean; // Whether item was on sale at order time
}

export interface Order {
  id: string;
  customerId: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  gstAmount: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface PaginatedOrdersResponse {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export enum OrderStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PROCESSING = "processing",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  REFUNDED = "refunded",
}

export interface QueryOrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
}

export interface Sale {
  id: string;
  productId: string;
  salePrice: number;
  startDate: string | null;
  endDate: string | null;
  status: "scheduled" | "active" | "expired" | "disabled";
  isActive: boolean;
  name: string | null;
  description: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSaleDto {
  productId: string;
  salePrice: number;
  startDate?: string;
  endDate?: string;
  name?: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateSaleDto {
  salePrice?: number;
  startDate?: string | null;
  endDate?: string | null;
  name?: string;
  description?: string;
  priority?: number;
  isActive?: boolean;
}

export interface EffectivePriceResponse {
  price: number;
  salePrice: number | null;
  isOnSale: boolean;
  saleId?: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string,
  ) {
    super(message || statusText);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include", // Include cookies in requests
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      response.statusText,
      `API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number; // Effective price (sale or regular)
  regularPrice: number;
  salePrice: number | null;
  isOnSale: boolean;
  gstRate: number;
  gstAmount: number;
  priceExcludingGst: number;
  priceIncludingGst: number;
  hsnCode: string | null;
  status: "draft" | "active" | "archived";
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProductsResponse {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductDto {
  title: string;
  description?: string;
  price: number;
  gstRate?: number;
  hsnCode?: string;
  status?: "draft" | "active" | "archived";
  categoryId?: string;
}

export interface UpdateProductDto {
  title?: string;
  description?: string;
  price?: number;
  gstRate?: number;
  hsnCode?: string;
  status?: "draft" | "active" | "archived";
  categoryId?: string;
}

export interface QueryProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: "draft" | "active" | "archived";
  categoryId?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
}

export const adminApi = {
  /**
   * Login user (sets httpOnly cookies)
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    return fetchApi<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Logout user (clears httpOnly cookies)
   */
  async logout(): Promise<{ message: string }> {
    return fetchApi<{ message: string }>("/auth/logout", {
      method: "POST",
    });
  },

  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<AdminStats> {
    return fetchApi<AdminStats>("/admin/stats");
  },

  /**
   * Get recent orders
   */
  async getRecentOrders(limit = 5): Promise<PaginatedOrdersResponse> {
    return fetchApi<PaginatedOrdersResponse>(
      `/admin/orders?page=1&limit=${limit}`,
    );
  },

  /**
   * Get all orders with pagination and filters
   */
  async getOrders(
    params?: QueryOrdersParams,
  ): Promise<PaginatedOrdersResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.status) searchParams.append("status", params.status);
    if (params?.startDate) searchParams.append("startDate", params.startDate);
    if (params?.endDate) searchParams.append("endDate", params.endDate);

    const query = searchParams.toString();
    return fetchApi<PaginatedOrdersResponse>(
      `/admin/orders${query ? `?${query}` : ""}`,
    );
  },

  /**
   * Get order details by ID
   */
  async getOrder(id: string): Promise<Order> {
    return fetchApi<Order>(`/orders/${id}`);
  },

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: string,
    status: OrderStatus,
  ): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Get all products with pagination and filters
   */
  async getProducts(
    params?: QueryProductsParams,
  ): Promise<PaginatedProductsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append("page", params.page.toString());
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.search) searchParams.append("search", params.search);
    if (params?.status) searchParams.append("status", params.status);
    if (params?.categoryId)
      searchParams.append("categoryId", params.categoryId);

    const query = searchParams.toString();
    return fetchApi<PaginatedProductsResponse>(
      `/admin/products${query ? `?${query}` : ""}`,
    );
  },

  /**
   * Get a single product by ID
   */
  async getProduct(id: string): Promise<Product> {
    return fetchApi<Product>(`/products/${id}`);
  },

  /**
   * Create a new product
   */
  async createProduct(data: CreateProductDto): Promise<Product> {
    return fetchApi<Product>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a product
   */
  async updateProduct(id: string, data: UpdateProductDto): Promise<Product> {
    return fetchApi<Product>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a product
   */
  async deleteProduct(id: string): Promise<void> {
    return fetchApi<void>(`/products/${id}`, {
      method: "DELETE",
    });
  },

  /**
   * Get active sale for a product
   */
  async getProductSale(productId: string): Promise<EffectivePriceResponse> {
    return fetchApi<EffectivePriceResponse>(
      `/admin/sales/product/${productId}`,
    );
  },

  /**
   * Get all sales with optional filters
   */
  async getSales(
    productId?: string,
    status?: "scheduled" | "active" | "expired" | "disabled",
  ): Promise<Sale[]> {
    const searchParams = new URLSearchParams();
    if (productId) searchParams.append("productId", productId);
    if (status) searchParams.append("status", status);

    const query = searchParams.toString();
    return fetchApi<Sale[]>(`/admin/sales${query ? `?${query}` : ""}`);
  },

  /**
   * Get sale by ID
   */
  async getSale(id: string): Promise<Sale> {
    return fetchApi<Sale>(`/admin/sales/${id}`);
  },

  /**
   * Create a new sale
   */
  async createSale(data: CreateSaleDto): Promise<Sale> {
    return fetchApi<Sale>("/admin/sales", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update a sale
   */
  async updateSale(id: string, data: UpdateSaleDto): Promise<Sale> {
    return fetchApi<Sale>(`/admin/sales/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Update sale status
   */
  async updateSaleStatus(id: string, isActive: boolean): Promise<Sale> {
    return fetchApi<Sale>(`/admin/sales/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    });
  },

  /**
   * Delete a sale
   */
  async deleteSale(id: string): Promise<{ message: string }> {
    return fetchApi<{ message: string }>(`/admin/sales/${id}`, {
      method: "DELETE",
    });
  },
};
