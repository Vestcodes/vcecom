import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { productVariants } from "./product-variants";
import { products } from "./products";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Product Variants Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(productVariants);
    await db.delete(products);
  });

  afterEach(async () => {
    await db.delete(productVariants);
    await db.delete(products);
    await closeTestDb(pool);
  });

  const createProduct = async () => {
    const [product] = await db
      .insert(products)
      .values({
        title: "Test Product",
        price: 100.0,
      })
      .returning();
    return product;
  };

  describe("Basic CRUD Operations", () => {
    it("should create a product variant with valid data", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 99.99,
          inventory: 100,
          size: "M",
          color: "Blue",
          weight: 0.5,
        })
        .returning();

      expect(variant).toBeDefined();
      expect(variant.productId).toBe(product.id);
      expect(variant.sku).toBe("SKU-001");
      expect(variant.price).toBe(99.99);
      expect(variant.inventory).toBe(100);
      expect(variant.size).toBe("M");
      expect(variant.color).toBe("Blue");
      expect(variant.weight).toBe(0.5);
      expect(variant.id).toBeDefined();
      expect(variant.createdAt).toBeInstanceOf(Date);
      expect(variant.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a variant by id", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-002",
          price: 50.0,
        })
        .returning();

      const [found] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.sku).toBe("SKU-002");
      expect(found?.price).toBe(50.0);
    });

    it("should update a variant", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-003",
          price: 100.0,
          inventory: 50,
        })
        .returning();

      const [updated] = await db
        .update(productVariants)
        .set({ price: 150.0, inventory: 75 })
        .where(eq(productVariants.id, inserted.id))
        .returning();

      expect(updated?.price).toBe(150.0);
      expect(updated?.inventory).toBe(75);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete a variant", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-004",
          price: 10.0,
        })
        .returning();

      await db
        .delete(productVariants)
        .where(eq(productVariants.id, inserted.id));

      const [found] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("SKU Uniqueness", () => {
    it("should enforce unique SKU constraint", async () => {
      const product = await createProduct();
      await db.insert(productVariants).values({
        productId: product.id,
        sku: "UNIQUE-SKU",
        price: 100.0,
      });

      await expect(
        db.insert(productVariants).values({
          productId: product.id,
          sku: "UNIQUE-SKU",
          price: 200.0,
        }),
      ).rejects.toThrow();
    });

    it("should allow different SKUs", async () => {
      const product = await createProduct();
      await db.insert(productVariants).values({
        productId: product.id,
        sku: "SKU-1",
        price: 100.0,
      });

      const [variant2] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-2",
          price: 200.0,
        })
        .returning();

      expect(variant2).toBeDefined();
      expect(variant2.sku).toBe("SKU-2");
    });
  });

  describe("Product Relationship", () => {
    it("should require product_id", async () => {
      await expect(
        db.insert(productVariants).values({
          sku: "SKU-001",
          price: 100.0,
        } as any),
      ).rejects.toThrow();
    });

    it("should cascade delete variants when product is deleted", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      await db.delete(products).where(eq(products.id, product.id));

      const [found] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, variant.id));

      expect(found).toBeUndefined();
    });

    it("should allow multiple variants per product", async () => {
      const product = await createProduct();
      const [variant1] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-SM",
          price: 100.0,
          size: "S",
        })
        .returning();

      const [variant2] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-MD",
          price: 110.0,
          size: "M",
        })
        .returning();

      expect(variant1.productId).toBe(product.id);
      expect(variant2.productId).toBe(product.id);
      expect(variant1.size).toBe("S");
      expect(variant2.size).toBe("M");
    });
  });

  describe("Inventory Management", () => {
    it("should default inventory to 0", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      expect(variant.inventory).toBe(0);
    });

    it("should store inventory count", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
          inventory: 50,
        })
        .returning();

      expect(variant.inventory).toBe(50);
    });

    it("should allow zero inventory", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
          inventory: 0,
        })
        .returning();

      expect(variant.inventory).toBe(0);
    });
  });

  describe("Optional Fields", () => {
    it("should allow null size", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      expect(variant.size).toBeNull();
    });

    it("should allow null color", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      expect(variant.color).toBeNull();
    });

    it("should allow null weight", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      expect(variant.weight).toBeNull();
    });

    it("should store size when provided", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
          size: "XL",
        })
        .returning();

      expect(variant.size).toBe("XL");
    });

    it("should store color when provided", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
          color: "Red",
        })
        .returning();

      expect(variant.color).toBe("Red");
    });

    it("should store weight when provided", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
          weight: 1.5,
        })
        .returning();

      expect(variant.weight).toBe(1.5);
    });
  });

  describe("Query Operations", () => {
    it("should find variants by product_id", async () => {
      const product = await createProduct();
      await db.insert(productVariants).values({
        productId: product.id,
        sku: "SKU-1",
        price: 100.0,
      });

      await db.insert(productVariants).values({
        productId: product.id,
        sku: "SKU-2",
        price: 200.0,
      });

      const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, product.id));

      expect(variants.length).toBe(2);
      expect(variants.every((v) => v.productId === product.id)).toBe(true);
    });

    it("should find variant by SKU", async () => {
      const product = await createProduct();
      await db.insert(productVariants).values({
        productId: product.id,
        sku: "FIND-ME-SKU",
        price: 100.0,
      });

      const [found] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.sku, "FIND-ME-SKU"));

      expect(found).toBeDefined();
      expect(found?.sku).toBe("FIND-ME-SKU");
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const product = await createProduct();
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      expect(variant.createdAt).toBeInstanceOf(Date);
      expect(variant.updatedAt).toBeInstanceOf(Date);
    });

    it("should update updatedAt on modification", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(productVariants)
        .set({ price: 150.0 })
        .where(eq(productVariants.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });
});
