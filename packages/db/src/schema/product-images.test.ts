import { eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { productImages } from "./product-images";
import { productVariants } from "./product-variants";
import { products } from "./products";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Product Images Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(productImages);
    await db.delete(productVariants);
    await db.delete(products);
  });

  afterEach(async () => {
    await db.delete(productImages);
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

  const createVariant = async (productId: string) => {
    const [variant] = await db
      .insert(productVariants)
      .values({
        productId,
        sku: `SKU-${Math.random().toString(36).substring(7)}`,
        price: 100.0,
      })
      .returning();
    return variant;
  };

  describe("Basic CRUD Operations", () => {
    it("should create a product image with valid data", async () => {
      const product = await createProduct();
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
          altText: "Product image",
          order: 1,
        })
        .returning();

      expect(image).toBeDefined();
      expect(image.productId).toBe(product.id);
      expect(image.url).toBe("https://example.com/image.jpg");
      expect(image.altText).toBe("Product image");
      expect(image.order).toBe(1);
      expect(image.id).toBeDefined();
      expect(image.createdAt).toBeInstanceOf(Date);
      expect(image.updatedAt).toBeInstanceOf(Date);
    });

    it("should read an image by id", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      const [found] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.url).toBe("https://example.com/image.jpg");
    });

    it("should update an image", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/old.jpg",
          order: 1,
        })
        .returning();

      const [updated] = await db
        .update(productImages)
        .set({ url: "https://example.com/new.jpg", order: 2 })
        .where(eq(productImages.id, inserted.id))
        .returning();

      expect(updated?.url).toBe("https://example.com/new.jpg");
      expect(updated?.order).toBe(2);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete an image", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      await db.delete(productImages).where(eq(productImages.id, inserted.id));

      const [found] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Product Relationship", () => {
    it("should require product_id", async () => {
      await expect(
        db.insert(productImages).values({
          url: "https://example.com/image.jpg",
        } as any),
      ).rejects.toThrow();
    });

    it("should cascade delete images when product is deleted", async () => {
      const product = await createProduct();
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      await db.delete(products).where(eq(products.id, product.id));

      const [found] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.id, image.id));

      expect(found).toBeUndefined();
    });

    it("should allow multiple images per product", async () => {
      const product = await createProduct();
      const [image1] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image1.jpg",
          order: 1,
        })
        .returning();

      const [image2] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image2.jpg",
          order: 2,
        })
        .returning();

      expect(image1.productId).toBe(product.id);
      expect(image2.productId).toBe(product.id);
      expect(image1.order).toBe(1);
      expect(image2.order).toBe(2);
    });
  });

  describe("Variant Relationship", () => {
    it("should allow null variant_id", async () => {
      const product = await createProduct();
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      expect(image.variantId).toBeNull();
    });

    it("should create image with variant_id", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          variantId: variant.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      expect(image.variantId).toBe(variant.id);
    });

    it("should cascade delete images when variant is deleted", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          variantId: variant.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      await db
        .delete(productVariants)
        .where(eq(productVariants.id, variant.id));

      const [found] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.id, image.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Image Ordering", () => {
    it("should default order to 0", async () => {
      const product = await createProduct();
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      expect(image.order).toBe(0);
    });

    it("should store order value", async () => {
      const product = await createProduct();
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
          order: 5,
        })
        .returning();

      expect(image.order).toBe(5);
    });

    it("should allow multiple images with different orders", async () => {
      const product = await createProduct();
      const [image1] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image1.jpg",
          order: 1,
        })
        .returning();

      const [image2] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image2.jpg",
          order: 2,
        })
        .returning();

      expect(image1.order).toBe(1);
      expect(image2.order).toBe(2);
    });
  });

  describe("Optional Fields", () => {
    it("should allow null alt_text", async () => {
      const product = await createProduct();
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      expect(image.altText).toBeNull();
    });

    it("should store alt_text when provided", async () => {
      const product = await createProduct();
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
          altText: "Product image description",
        })
        .returning();

      expect(image.altText).toBe("Product image description");
    });
  });

  describe("Query Operations", () => {
    it("should find images by product_id", async () => {
      const product = await createProduct();
      await db.insert(productImages).values({
        productId: product.id,
        url: "https://example.com/image1.jpg",
      });

      await db.insert(productImages).values({
        productId: product.id,
        url: "https://example.com/image2.jpg",
      });

      const images = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, product.id));

      expect(images.length).toBe(2);
      expect(images.every((img) => img.productId === product.id)).toBe(true);
    });

    it("should find images by variant_id", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await db.insert(productImages).values({
        productId: product.id,
        variantId: variant.id,
        url: "https://example.com/image1.jpg",
      });

      const images = await db
        .select()
        .from(productImages)
        .where(eq(productImages.variantId, variant.id));

      expect(images.length).toBe(1);
      expect(images[0]?.variantId).toBe(variant.id);
    });

    it("should find product images without variant (variant_id is null)", async () => {
      const product = await createProduct();
      await db.insert(productImages).values({
        productId: product.id,
        url: "https://example.com/image.jpg",
      });

      const images = await db
        .select()
        .from(productImages)
        .where(isNull(productImages.variantId));

      expect(images.length).toBeGreaterThan(0);
      expect(images.every((img) => img.variantId === null)).toBe(true);
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const product = await createProduct();
      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      expect(image.createdAt).toBeInstanceOf(Date);
      expect(image.updatedAt).toBeInstanceOf(Date);
    });

    it("should update updatedAt on modification", async () => {
      const product = await createProduct();
      const [inserted] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(productImages)
        .set({ url: "https://example.com/new.jpg" })
        .where(eq(productImages.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });
});
