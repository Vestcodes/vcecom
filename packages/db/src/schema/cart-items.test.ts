import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { cartItems } from "./cart-items";
import { carts } from "./carts";
import { categories } from "./categories";
import { productVariants } from "./product-variants";
import { products } from "./products";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Cart Items Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(cartItems);
    await db.delete(carts);
    await db.delete(productVariants);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(customers);
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(cartItems);
    await db.delete(carts);
    await db.delete(productVariants);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(customers);
    await db.delete(users);
    await closeTestDb(pool);
  });

  async function createTestProductVariant() {
    const [category] = await db
      .insert(categories)
      .values({
        name: "Test Category",
        slug: `test-category-${Math.random()}`,
      })
      .returning();

    const [product] = await db
      .insert(products)
      .values({
        title: "Test Product",
        price: 100.0,
        gstRate: 18.0,
        status: "active",
        categoryId: category.id,
      })
      .returning();

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId: product.id,
        sku: `SKU-${Math.random().toString(36).substring(7)}`,
        price: 100.0,
        inventory: 10,
      })
      .returning();

    return variant;
  }

  async function createTestCart() {
    const [cart] = await db
      .insert(carts)
      .values({
        sessionId: `session-${Math.random().toString(36).substring(7)}`,
        subtotal: 0,
        gstAmount: 0,
        total: 0,
      })
      .returning();

    return cart;
  }

  describe("Basic CRUD Operations", () => {
    it("should create a cart item with valid data", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [cartItem] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 2,
          price: 100.0,
        })
        .returning();

      expect(cartItem).toBeDefined();
      expect(cartItem.cartId).toBe(cart.id);
      expect(cartItem.productVariantId).toBe(variant.id);
      expect(cartItem.quantity).toBe(2);
      expect(cartItem.price).toBe(100.0);
      expect(cartItem.id).toBeDefined();
      expect(cartItem.createdAt).toBeInstanceOf(Date);
      expect(cartItem.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a cart item by id", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [inserted] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 3,
          price: 150.0,
        })
        .returning();

      const [found] = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.quantity).toBe(3);
      expect(found?.price).toBe(150.0);
    });

    it("should update a cart item", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [inserted] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
        })
        .returning();

      const [updated] = await db
        .update(cartItems)
        .set({ quantity: 5, price: 200.0 })
        .where(eq(cartItems.id, inserted.id))
        .returning();

      expect(updated?.quantity).toBe(5);
      expect(updated?.price).toBe(200.0);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete a cart item", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [inserted] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
        })
        .returning();

      await db.delete(cartItems).where(eq(cartItems.id, inserted.id));

      const [found] = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Default Values", () => {
    it("should set default quantity to 1", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [cartItem] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          price: 100.0,
        })
        .returning();

      expect(cartItem.quantity).toBe(1);
    });
  });

  describe("Multiple Items in Cart", () => {
    it("should allow multiple items in the same cart", async () => {
      const cart = await createTestCart();
      const variant1 = await createTestProductVariant();
      const variant2 = await createTestProductVariant();

      const [item1] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant1.id,
          quantity: 2,
          price: 100.0,
        })
        .returning();

      const [item2] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant2.id,
          quantity: 3,
          price: 200.0,
        })
        .returning();

      expect(item1.cartId).toBe(cart.id);
      expect(item2.cartId).toBe(cart.id);
      expect(item1.productVariantId).toBe(variant1.id);
      expect(item2.productVariantId).toBe(variant2.id);
    });

    it("should allow same product variant in different carts", async () => {
      const cart1 = await createTestCart();
      const cart2 = await createTestCart();
      const variant = await createTestProductVariant();

      const [item1] = await db
        .insert(cartItems)
        .values({
          cartId: cart1.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
        })
        .returning();

      const [item2] = await db
        .insert(cartItems)
        .values({
          cartId: cart2.id,
          productVariantId: variant.id,
          quantity: 2,
          price: 100.0,
        })
        .returning();

      expect(item1.cartId).toBe(cart1.id);
      expect(item2.cartId).toBe(cart2.id);
      expect(item1.productVariantId).toBe(variant.id);
      expect(item2.productVariantId).toBe(variant.id);
    });
  });

  describe("Cascade Delete", () => {
    it("should delete cart items when cart is deleted", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [cartItem] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
        })
        .returning();

      await db.delete(carts).where(eq(carts.id, cart.id));

      const [found] = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, cartItem.id));

      expect(found).toBeUndefined();
    });

    it("should delete cart items when product variant is deleted", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [cartItem] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
        })
        .returning();

      await db
        .delete(productVariants)
        .where(eq(productVariants.id, variant.id));

      const [found] = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.id, cartItem.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Query Operations", () => {
    it("should find cart items by cart_id", async () => {
      const cart1 = await createTestCart();
      const cart2 = await createTestCart();
      const variant1 = await createTestProductVariant();
      const variant2 = await createTestProductVariant();

      await db.insert(cartItems).values({
        cartId: cart1.id,
        productVariantId: variant1.id,
        quantity: 1,
        price: 100.0,
      });

      await db.insert(cartItems).values({
        cartId: cart1.id,
        productVariantId: variant2.id,
        quantity: 2,
        price: 200.0,
      });

      await db.insert(cartItems).values({
        cartId: cart2.id,
        productVariantId: variant1.id,
        quantity: 3,
        price: 100.0,
      });

      const cart1Items = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cart1.id));

      expect(cart1Items.length).toBe(2);
      expect(cart1Items.every((item) => item.cartId === cart1.id)).toBe(true);
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [cartItem] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
        })
        .returning();

      expect(cartItem.createdAt).toBeInstanceOf(Date);
      expect(cartItem.updatedAt).toBeInstanceOf(Date);
      expect(cartItem.createdAt.getTime()).toBeGreaterThan(0);
      expect(cartItem.updatedAt.getTime()).toBeGreaterThan(0);
    });

    it("should update updatedAt on modification", async () => {
      const cart = await createTestCart();
      const variant = await createTestProductVariant();

      const [inserted] = await db
        .insert(cartItems)
        .values({
          cartId: cart.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
        })
        .returning();

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(cartItems)
        .set({ quantity: 2 })
        .where(eq(cartItems.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });
});
