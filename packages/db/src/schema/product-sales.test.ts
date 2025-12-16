import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  closeTestDb,
  createTestDb,
  getTestDatabaseUrl,
  isDatabaseAvailable,
} from "../test-utils/db";
import { categories } from "./categories";
import { productSales } from "./product-sales";
import { products } from "./products";

describe.skipIf(!isDatabaseAvailable())("Product Sales Schema", () => {
  const { db, pool } = createTestDb(getTestDatabaseUrl());

  beforeEach(async () => {
    await db.delete(productSales);
    await db.delete(products);
    await db.delete(categories);
  });

  afterEach(async () => {
    await db.delete(productSales);
    await db.delete(products);
    await db.delete(categories);
  });

  afterAll(async () => {
    await closeTestDb(pool);
  });

  const createCategory = async () => {
    const [category] = await db
      .insert(categories)
      .values({
        name: "Test Category",
        slug: `test-category-${Math.random().toString(36).substring(7)}`,
      })
      .returning();
    return category;
  };

  const createProduct = async (price = 100.0) => {
    const category = await createCategory();
    const [product] = await db
      .insert(products)
      .values({
        title: "Test Product",
        price,
        gstRate: 18.0,
        status: "active",
        categoryId: category.id,
      })
      .returning();
    return product;
  };

  describe("Basic CRUD Operations", () => {
    it("should create a product sale with valid data", async () => {
      const product = await createProduct(100.0);
      const [sale] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 79.99,
          status: "active",
          isActive: true,
          name: "Summer Sale",
          description: "Summer discount",
          priority: 0,
        })
        .returning();

      expect(sale).toBeDefined();
      expect(sale.productId).toBe(product.id);
      expect(sale.salePrice).toBe(79.99);
      expect(sale.status).toBe("active");
      expect(sale.isActive).toBe(true);
      expect(sale.name).toBe("Summer Sale");
      expect(sale.priority).toBe(0);
      expect(sale.id).toBeDefined();
      expect(sale.createdAt).toBeInstanceOf(Date);
      expect(sale.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a sale by id", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 50.0,
        })
        .returning();

      const [found] = await db
        .select()
        .from(productSales)
        .where(eq(productSales.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.salePrice).toBe(50.0);
      expect(found?.productId).toBe(product.id);
    });

    it("should update a sale", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 80.0,
          name: "Old Sale",
        })
        .returning();

      const [updated] = await db
        .update(productSales)
        .set({ salePrice: 70.0, name: "New Sale" })
        .where(eq(productSales.id, inserted.id))
        .returning();

      expect(updated).toBeDefined();
      expect(updated?.salePrice).toBe(70.0);
      expect(updated?.name).toBe("New Sale");
    });

    it("should delete a sale", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 50.0,
        })
        .returning();

      await db.delete(productSales).where(eq(productSales.id, inserted.id));

      const [found] = await db
        .select()
        .from(productSales)
        .where(eq(productSales.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Date Range Handling", () => {
    it("should create sale with date range", async () => {
      const product = await createProduct();
      const startDate = new Date("2025-01-01T00:00:00Z");
      const endDate = new Date("2025-12-31T23:59:59Z");

      const [sale] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 80.0,
          startDate,
          endDate,
        })
        .returning();

      expect(sale.startDate).toEqual(startDate);
      expect(sale.endDate).toEqual(endDate);
    });

    it("should create always-active sale (null dates)", async () => {
      const product = await createProduct();
      const [sale] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 80.0,
          startDate: null,
          endDate: null,
        })
        .returning();

      expect(sale.startDate).toBeNull();
      expect(sale.endDate).toBeNull();
    });

    it("should query sales with date range", async () => {
      const product = await createProduct();
      const now = new Date();
      const futureDate = new Date(now.getTime() + 86400000); // +1 day

      await db.insert(productSales).values({
        productId: product.id,
        salePrice: 80.0,
        startDate: now,
        endDate: futureDate,
      });

      const sales = await db
        .select()
        .from(productSales)
        .where(
          and(
            eq(productSales.productId, product.id),
            lte(productSales.startDate, futureDate),
          ),
        );

      expect(sales.length).toBeGreaterThan(0);
    });
  });

  describe("Status and Priority", () => {
    it("should default to scheduled status", async () => {
      const product = await createProduct();
      const [sale] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 80.0,
        })
        .returning();

      expect(sale.status).toBe("scheduled");
    });

    it("should default to active isActive", async () => {
      const product = await createProduct();
      const [sale] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 80.0,
        })
        .returning();

      expect(sale.isActive).toBe(true);
    });

    it("should default to priority 0", async () => {
      const product = await createProduct();
      const [sale] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 80.0,
        })
        .returning();

      expect(sale.priority).toBe(0);
    });

    it("should allow multiple sales with different priorities", async () => {
      const product = await createProduct();
      const [sale1] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 80.0,
          priority: 1,
        })
        .returning();

      const [sale2] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 70.0,
          priority: 2,
        })
        .returning();

      expect(sale1.priority).toBe(1);
      expect(sale2.priority).toBe(2);
      expect(sale1.productId).toBe(product.id);
      expect(sale2.productId).toBe(product.id);
    });
  });

  describe("Cascade Deletion", () => {
    it("should cascade delete sales when product is deleted", async () => {
      const product = await createProduct();
      const [sale] = await db
        .insert(productSales)
        .values({
          productId: product.id,
          salePrice: 80.0,
        })
        .returning();

      await db.delete(products).where(eq(products.id, product.id));

      const [foundSale] = await db
        .select()
        .from(productSales)
        .where(eq(productSales.id, sale.id));

      expect(foundSale).toBeUndefined();
    });
  });

  describe("Product-Sale Relationships", () => {
    it("should find sales by product_id", async () => {
      const product = await createProduct();
      await db.insert(productSales).values({
        productId: product.id,
        salePrice: 80.0,
      });
      await db.insert(productSales).values({
        productId: product.id,
        salePrice: 70.0,
      });

      const sales = await db
        .select()
        .from(productSales)
        .where(eq(productSales.productId, product.id));

      expect(sales.length).toBe(2);
      expect(sales.every((s) => s.productId === product.id)).toBe(true);
    });

    it("should allow multiple products to have sales", async () => {
      const product1 = await createProduct(100.0);
      const product2 = await createProduct(200.0);

      await db.insert(productSales).values({
        productId: product1.id,
        salePrice: 80.0,
      });
      await db.insert(productSales).values({
        productId: product2.id,
        salePrice: 150.0,
      });

      const sales = await db.select().from(productSales);
      expect(sales.length).toBe(2);
      expect(sales[0]?.productId).not.toBe(sales[1]?.productId);
    });
  });

  describe("Query Operations", () => {
    it("should find active sales", async () => {
      const product = await createProduct();
      await db.insert(productSales).values({
        productId: product.id,
        salePrice: 80.0,
        status: "active",
        isActive: true,
      });
      await db.insert(productSales).values({
        productId: product.id,
        salePrice: 70.0,
        status: "expired",
        isActive: false,
      });

      const activeSales = await db
        .select()
        .from(productSales)
        .where(
          and(
            eq(productSales.productId, product.id),
            eq(productSales.status, "active"),
            eq(productSales.isActive, true),
          ),
        );

      expect(activeSales.length).toBe(1);
      expect(activeSales[0]?.status).toBe("active");
    });

    it("should find always-active sales (null dates)", async () => {
      const product = await createProduct();
      await db.insert(productSales).values({
        productId: product.id,
        salePrice: 80.0,
        startDate: null,
        endDate: null,
      });

      const sales = await db
        .select()
        .from(productSales)
        .where(
          and(
            eq(productSales.productId, product.id),
            isNull(productSales.startDate),
            isNull(productSales.endDate),
          ),
        );

      expect(sales.length).toBeGreaterThan(0);
      expect(sales[0]?.startDate).toBeNull();
      expect(sales[0]?.endDate).toBeNull();
    });
  });
});

