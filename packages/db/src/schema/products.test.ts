import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { categories } from "./categories";
import { products } from "./products";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Products Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(products);
    await db.delete(categories);
  });

  afterEach(async () => {
    await db.delete(products);
    await db.delete(categories);
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

  describe("Basic CRUD Operations", () => {
    it("should create a product with valid data", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Test Product",
          description: "Product description",
          price: 99.99,
          gstRate: 18.0,
          status: "active",
        })
        .returning();

      expect(product).toBeDefined();
      expect(product.title).toBe("Test Product");
      expect(product.description).toBe("Product description");
      expect(product.price).toBe(99.99);
      expect(product.gstRate).toBe(18.0);
      expect(product.status).toBe("active");
      expect(product.id).toBeDefined();
      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a product by id", async () => {
      const [inserted] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 50.0,
        })
        .returning();

      const [found] = await db
        .select()
        .from(products)
        .where(eq(products.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.title).toBe("Product");
      expect(found?.price).toBe(50.0);
    });

    it("should update a product", async () => {
      const [inserted] = await db
        .insert(products)
        .values({
          title: "Old Title",
          price: 100.0,
        })
        .returning();

      const [updated] = await db
        .update(products)
        .set({ title: "New Title", price: 150.0 })
        .where(eq(products.id, inserted.id))
        .returning();

      expect(updated?.title).toBe("New Title");
      expect(updated?.price).toBe(150.0);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete a product", async () => {
      const [inserted] = await db
        .insert(products)
        .values({
          title: "To Delete",
          price: 10.0,
        })
        .returning();

      await db.delete(products).where(eq(products.id, inserted.id));

      const [found] = await db
        .select()
        .from(products)
        .where(eq(products.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Product Status Enum", () => {
    it("should default to draft status", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      expect(product.status).toBe("draft");
    });

    it("should accept draft status", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          status: "draft",
        })
        .returning();

      expect(product.status).toBe("draft");
    });

    it("should accept active status", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          status: "active",
        })
        .returning();

      expect(product.status).toBe("active");
    });

    it("should accept archived status", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          status: "archived",
        })
        .returning();

      expect(product.status).toBe("archived");
    });
  });

  describe("GST Rate", () => {
    it("should default GST rate to 0", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      expect(product.gstRate).toBe(0);
    });

    it("should store GST rate", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          gstRate: 18.0,
        })
        .returning();

      expect(product.gstRate).toBe(18.0);
    });

    it("should allow different GST rates", async () => {
      const [product1] = await db
        .insert(products)
        .values({
          title: "Product 1",
          price: 100.0,
          gstRate: 5.0,
        })
        .returning();

      const [product2] = await db
        .insert(products)
        .values({
          title: "Product 2",
          price: 200.0,
          gstRate: 28.0,
        })
        .returning();

      expect(product1.gstRate).toBe(5.0);
      expect(product2.gstRate).toBe(28.0);
    });
  });

  describe("Category Relationship", () => {
    it("should create product without category", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      expect(product.categoryId).toBeNull();
    });

    it("should create product with category", async () => {
      const category = await createCategory();
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          categoryId: category.id,
        })
        .returning();

      expect(product.categoryId).toBe(category.id);
    });

    it("should set category_id to null when category is deleted", async () => {
      const category = await createCategory();
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          categoryId: category.id,
        })
        .returning();

      await db.delete(categories).where(eq(categories.id, category.id));

      const [updated] = await db
        .select()
        .from(products)
        .where(eq(products.id, product.id));

      expect(updated?.categoryId).toBeNull();
    });
  });

  describe("Optional Fields", () => {
    it("should allow null description", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      expect(product.description).toBeNull();
    });

    it("should store description when provided", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          description: "Test description",
        })
        .returning();

      expect(product.description).toBe("Test description");
    });
  });

  describe("Price Validation", () => {
    it("should accept positive prices", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 99.99,
        })
        .returning();

      expect(product.price).toBe(99.99);
    });

    it("should accept zero price", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Free Product",
          price: 0,
        })
        .returning();

      expect(product.price).toBe(0);
    });
  });

  describe("Query Operations", () => {
    it("should find products by status", async () => {
      await db.insert(products).values({
        title: "Draft Product",
        price: 100.0,
        status: "draft",
      });

      await db.insert(products).values({
        title: "Active Product",
        price: 200.0,
        status: "active",
      });

      const activeProducts = await db
        .select()
        .from(products)
        .where(eq(products.status, "active"));

      expect(activeProducts.length).toBeGreaterThan(0);
      expect(activeProducts.every((p) => p.status === "active")).toBe(true);
    });

    it("should find products by category", async () => {
      const category = await createCategory();
      await db.insert(products).values({
        title: "Product 1",
        price: 100.0,
        categoryId: category.id,
      });

      await db.insert(products).values({
        title: "Product 2",
        price: 200.0,
        categoryId: category.id,
      });

      const categoryProducts = await db
        .select()
        .from(products)
        .where(eq(products.categoryId, category.id));

      expect(categoryProducts.length).toBe(2);
      expect(categoryProducts.every((p) => p.categoryId === category.id)).toBe(
        true,
      );
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      expect(product.createdAt).toBeInstanceOf(Date);
      expect(product.updatedAt).toBeInstanceOf(Date);
    });

    it("should update updatedAt on modification", async () => {
      const [inserted] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(products)
        .set({ title: "Updated Product" })
        .where(eq(products.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });
});
