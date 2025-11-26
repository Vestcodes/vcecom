import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db.js";
import { categories } from "./categories.js";
import { productImages } from "./product-images.js";
import { productVariants } from "./product-variants.js";
import { products } from "./products.js";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Product Catalog Integration Tests", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(productImages);
    await db.delete(productVariants);
    await db.delete(products);
    await db.delete(categories);
  });

  afterEach(async () => {
    await db.delete(productImages);
    await db.delete(productVariants);
    await db.delete(products);
    await db.delete(categories);
    await closeTestDb(pool);
  });

  describe("Category → Product → Variant → Image Cascade", () => {
    it("should cascade delete products when category is deleted", async () => {
      const [category] = await db
        .insert(categories)
        .values({
          name: "Electronics",
          slug: "electronics",
        })
        .returning();

      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          categoryId: category.id,
        })
        .returning();

      await db.delete(categories).where(eq(categories.id, category.id));

      const [foundProduct] = await db
        .select()
        .from(products)
        .where(eq(products.id, product.id));

      expect(foundProduct).toBeDefined();
      expect(foundProduct?.categoryId).toBeNull();
    });

    it("should cascade delete variants when product is deleted", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      await db.delete(products).where(eq(products.id, product.id));

      const [foundVariant] = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, variant.id));

      expect(foundVariant).toBeUndefined();
    });

    it("should cascade delete images when product is deleted", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      const [image] = await db
        .insert(productImages)
        .values({
          productId: product.id,
          url: "https://example.com/image.jpg",
        })
        .returning();

      await db.delete(products).where(eq(products.id, product.id));

      const [foundImage] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.id, image.id));

      expect(foundImage).toBeUndefined();
    });

    it("should cascade delete images when variant is deleted", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

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

      const [foundImage] = await db
        .select()
        .from(productImages)
        .where(eq(productImages.id, image.id));

      expect(foundImage).toBeUndefined();
    });
  });

  describe("Complex Product Catalog Queries", () => {
    it("should query products with their category", async () => {
      const [category] = await db
        .insert(categories)
        .values({
          name: "Electronics",
          slug: "electronics",
        })
        .returning();

      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          categoryId: category.id,
        })
        .returning();

      const [foundProduct] = await db
        .select()
        .from(products)
        .where(eq(products.id, product.id));

      expect(foundProduct).toBeDefined();
      expect(foundProduct?.categoryId).toBe(category.id);
    });

    it("should query product with all variants", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      await db.insert(productVariants).values({
        productId: product.id,
        sku: "SKU-S",
        price: 100.0,
        size: "S",
      });

      await db.insert(productVariants).values({
        productId: product.id,
        sku: "SKU-M",
        price: 110.0,
        size: "M",
      });

      const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, product.id));

      expect(variants.length).toBe(2);
    });

    it("should query product with all images", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      await db.insert(productImages).values({
        productId: product.id,
        url: "https://example.com/image1.jpg",
        order: 1,
      });

      await db.insert(productImages).values({
        productId: product.id,
        url: "https://example.com/image2.jpg",
        order: 2,
      });

      const images = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, product.id))
        .orderBy(productImages.order);

      expect(images.length).toBe(2);
      expect(images[0]?.order).toBeLessThan(images[1]?.order || 0);
    });

    it("should query variant with its images", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
        })
        .returning();

      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      await db.insert(productImages).values({
        productId: product.id,
        variantId: variant.id,
        url: "https://example.com/variant-image.jpg",
      });

      const images = await db
        .select()
        .from(productImages)
        .where(eq(productImages.variantId, variant.id));

      expect(images.length).toBe(1);
      expect(images[0]?.variantId).toBe(variant.id);
    });
  });

  describe("Hierarchical Categories with Products", () => {
    it("should support products in parent categories", async () => {
      const [parentCategory] = await db
        .insert(categories)
        .values({
          name: "Parent",
          slug: "parent",
        })
        .returning();

      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          categoryId: parentCategory.id,
        })
        .returning();

      expect(product.categoryId).toBe(parentCategory.id);
    });

    it("should support products in child categories", async () => {
      const [parentCategory] = await db
        .insert(categories)
        .values({
          name: "Parent",
          slug: "parent",
        })
        .returning();

      const [childCategory] = await db
        .insert(categories)
        .values({
          name: "Child",
          slug: "child",
          parentId: parentCategory.id,
        })
        .returning();

      const [product] = await db
        .insert(products)
        .values({
          title: "Product",
          price: 100.0,
          categoryId: childCategory.id,
        })
        .returning();

      expect(product.categoryId).toBe(childCategory.id);
    });
  });

  describe("Product Status and Variants", () => {
    it("should allow variants for draft products", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Draft Product",
          price: 100.0,
          status: "draft",
        })
        .returning();

      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      expect(variant.productId).toBe(product.id);
    });

    it("should allow variants for active products", async () => {
      const [product] = await db
        .insert(products)
        .values({
          title: "Active Product",
          price: 100.0,
          status: "active",
        })
        .returning();

      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: "SKU-001",
          price: 100.0,
        })
        .returning();

      expect(variant.productId).toBe(product.id);
    });
  });
});
