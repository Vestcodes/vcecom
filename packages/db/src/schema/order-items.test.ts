import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { randomEmail, randomPhone, randomPinCode } from "../test-utils/helpers";
import { addresses } from "./addresses";
import { categories } from "./categories";
import { customers } from "./customers";
import { orderItems } from "./order-items";
import { orders } from "./orders";
import { productVariants } from "./product-variants";
import { products } from "./products";
import { users } from "./users";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Order Items Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(productVariants);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(addresses);
    await db.delete(customers);
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(orderItems);
    await db.delete(orders);
    await db.delete(productVariants);
    await db.delete(products);
    await db.delete(categories);
    await db.delete(addresses);
    await db.delete(customers);
    await db.delete(users);
    await closeTestDb(pool);
  });

  async function createTestOrder() {
    const [user] = await db
      .insert(users)
      .values({
        email: randomEmail(),
        passwordHash: "$2b$10$testhash",
      })
      .returning();

    const [customer] = await db
      .insert(customers)
      .values({
        userId: user.id,
        email: randomEmail(),
        phone: randomPhone(),
        name: "Test Customer",
      })
      .returning();

    const [shippingAddress] = await db
      .insert(addresses)
      .values({
        customerId: customer.id,
        street: "Shipping Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: randomPinCode(),
        type: "shipping",
      })
      .returning();

    const [billingAddress] = await db
      .insert(addresses)
      .values({
        customerId: customer.id,
        street: "Billing Street",
        city: "Delhi",
        state: "Delhi",
        pincode: randomPinCode(),
        type: "billing",
      })
      .returning();

    const [order] = await db
      .insert(orders)
      .values({
        customerId: customer.id,
        orderNumber: `ORD-${Math.random().toString(36).substring(7)}`,
        subtotal: 0,
        gstAmount: 0,
        shippingCost: 0,
        total: 0,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
      })
      .returning();

    return order;
  }

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

  describe("Basic CRUD Operations", () => {
    it("should create an order item with valid data", async () => {
      const order = await createTestOrder();
      const variant = await createTestProductVariant();

      const [orderItem] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant.id,
          quantity: 2,
          price: 100.0,
          gstRate: 18.0,
          gstAmount: 36.0,
        })
        .returning();

      expect(orderItem).toBeDefined();
      expect(orderItem.orderId).toBe(order.id);
      expect(orderItem.productVariantId).toBe(variant.id);
      expect(orderItem.quantity).toBe(2);
      expect(orderItem.price).toBe(100.0);
      expect(orderItem.gstRate).toBe(18.0);
      expect(orderItem.gstAmount).toBe(36.0);
      expect(orderItem.id).toBeDefined();
      expect(orderItem.createdAt).toBeInstanceOf(Date);
      expect(orderItem.updatedAt).toBeInstanceOf(Date);
    });

    it("should read an order item by id", async () => {
      const order = await createTestOrder();
      const variant = await createTestProductVariant();

      const [inserted] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant.id,
          quantity: 3,
          price: 150.0,
          gstRate: 18.0,
          gstAmount: 81.0,
        })
        .returning();

      const [found] = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.quantity).toBe(3);
      expect(found?.price).toBe(150.0);
    });

    it("should update an order item", async () => {
      const order = await createTestOrder();
      const variant = await createTestProductVariant();

      const [inserted] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
          gstRate: 18.0,
          gstAmount: 18.0,
        })
        .returning();

      const [updated] = await db
        .update(orderItems)
        .set({ quantity: 5, price: 200.0, gstAmount: 180.0 })
        .where(eq(orderItems.id, inserted.id))
        .returning();

      expect(updated?.quantity).toBe(5);
      expect(updated?.price).toBe(200.0);
      expect(updated?.gstAmount).toBe(180.0);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });

  describe("Default Values", () => {
    it("should set default values for quantity, gstRate, and gstAmount", async () => {
      const order = await createTestOrder();
      const variant = await createTestProductVariant();

      const [orderItem] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant.id,
          price: 100.0,
        })
        .returning();

      expect(orderItem.quantity).toBe(1);
      expect(orderItem.gstRate).toBe(0);
      expect(orderItem.gstAmount).toBe(0);
    });
  });

  describe("Multiple Items in Order", () => {
    it("should allow multiple items in the same order", async () => {
      const order = await createTestOrder();
      const variant1 = await createTestProductVariant();
      const variant2 = await createTestProductVariant();

      const [item1] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant1.id,
          quantity: 2,
          price: 100.0,
          gstRate: 18.0,
          gstAmount: 36.0,
        })
        .returning();

      const [item2] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant2.id,
          quantity: 3,
          price: 200.0,
          gstRate: 18.0,
          gstAmount: 108.0,
        })
        .returning();

      expect(item1.orderId).toBe(order.id);
      expect(item2.orderId).toBe(order.id);
      expect(item1.productVariantId).toBe(variant1.id);
      expect(item2.productVariantId).toBe(variant2.id);
    });
  });

  describe("Cascade Delete", () => {
    it("should delete order items when order is deleted", async () => {
      const order = await createTestOrder();
      const variant = await createTestProductVariant();

      const [orderItem] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
          gstRate: 18.0,
          gstAmount: 18.0,
        })
        .returning();

      await db.delete(orders).where(eq(orders.id, order.id));

      const [found] = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.id, orderItem.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Query Operations", () => {
    it("should find order items by order_id", async () => {
      const order1 = await createTestOrder();
      const order2 = await createTestOrder();
      const variant1 = await createTestProductVariant();
      const variant2 = await createTestProductVariant();

      await db.insert(orderItems).values({
        orderId: order1.id,
        productVariantId: variant1.id,
        quantity: 1,
        price: 100.0,
        gstRate: 18.0,
        gstAmount: 18.0,
      });

      await db.insert(orderItems).values({
        orderId: order1.id,
        productVariantId: variant2.id,
        quantity: 2,
        price: 200.0,
        gstRate: 18.0,
        gstAmount: 72.0,
      });

      await db.insert(orderItems).values({
        orderId: order2.id,
        productVariantId: variant1.id,
        quantity: 3,
        price: 100.0,
        gstRate: 18.0,
        gstAmount: 54.0,
      });

      const order1Items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order1.id));

      expect(order1Items.length).toBe(2);
      expect(order1Items.every((item) => item.orderId === order1.id)).toBe(
        true,
      );
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const order = await createTestOrder();
      const variant = await createTestProductVariant();

      const [orderItem] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
          gstRate: 18.0,
          gstAmount: 18.0,
        })
        .returning();

      expect(orderItem.createdAt).toBeInstanceOf(Date);
      expect(orderItem.updatedAt).toBeInstanceOf(Date);
      expect(orderItem.createdAt.getTime()).toBeGreaterThan(0);
      expect(orderItem.updatedAt.getTime()).toBeGreaterThan(0);
    });

    it("should update updatedAt on modification", async () => {
      const order = await createTestOrder();
      const variant = await createTestProductVariant();

      const [inserted] = await db
        .insert(orderItems)
        .values({
          orderId: order.id,
          productVariantId: variant.id,
          quantity: 1,
          price: 100.0,
          gstRate: 18.0,
          gstAmount: 18.0,
        })
        .returning();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(orderItems)
        .set({ quantity: 2 })
        .where(eq(orderItems.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });
});
