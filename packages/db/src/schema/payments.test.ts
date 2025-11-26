import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { randomEmail, randomPhone, randomPinCode } from "../test-utils/helpers";
import { addresses } from "./addresses";
import { customers } from "./customers";
import { orders } from "./orders";
import { payments } from "./payments";
import { users } from "./users";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Payments Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(payments);
    await db.delete(orders);
    await db.delete(addresses);
    await db.delete(customers);
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(payments);
    await db.delete(orders);
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
        subtotal: 1000.0,
        gstAmount: 180.0,
        shippingCost: 50.0,
        total: 1230.0,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
      })
      .returning();

    return order;
  }

  describe("Basic CRUD Operations", () => {
    it("should create a payment with valid data", async () => {
      const order = await createTestOrder();

      const [payment] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          razorpayPaymentId: "pay_test123",
          razorpayOrderId: "order_test123",
          amount: 1230.0,
          status: "pending",
          method: "razorpay",
        })
        .returning();

      expect(payment).toBeDefined();
      expect(payment.orderId).toBe(order.id);
      expect(payment.razorpayPaymentId).toBe("pay_test123");
      expect(payment.razorpayOrderId).toBe("order_test123");
      expect(payment.amount).toBe(1230.0);
      expect(payment.status).toBe("pending");
      expect(payment.method).toBe("razorpay");
      expect(payment.id).toBeDefined();
      expect(payment.createdAt).toBeInstanceOf(Date);
      expect(payment.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a payment by id", async () => {
      const order = await createTestOrder();

      const [inserted] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 500.0,
          status: "captured",
          method: "card",
        })
        .returning();

      const [found] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.amount).toBe(500.0);
      expect(found?.status).toBe("captured");
    });

    it("should update a payment", async () => {
      const order = await createTestOrder();

      const [inserted] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 1000.0,
          status: "pending",
          method: "razorpay",
        })
        .returning();

      const [updated] = await db
        .update(payments)
        .set({
          status: "captured",
          razorpayPaymentId: "pay_updated123",
        })
        .where(eq(payments.id, inserted.id))
        .returning();

      expect(updated?.status).toBe("captured");
      expect(updated?.razorpayPaymentId).toBe("pay_updated123");
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete a payment", async () => {
      const order = await createTestOrder();

      const [inserted] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 1000.0,
          status: "pending",
          method: "razorpay",
        })
        .returning();

      await db.delete(payments).where(eq(payments.id, inserted.id));

      const [found] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Payment Status Enum", () => {
    it("should accept all valid status values", async () => {
      const order = await createTestOrder();

      const statuses = [
        "pending",
        "processing",
        "captured",
        "failed",
        "refunded",
        "partially_refunded",
      ] as const;

      for (const status of statuses) {
        const [payment] = await db
          .insert(payments)
          .values({
            orderId: order.id,
            amount: 100.0,
            status,
            method: "razorpay",
          })
          .returning();

        expect(payment.status).toBe(status);
      }
    });

    it("should default to pending status", async () => {
      const order = await createTestOrder();

      const [payment] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 1000.0,
          method: "razorpay",
        })
        .returning();

      expect(payment.status).toBe("pending");
    });
  });

  describe("Payment Method Enum", () => {
    it("should accept all valid method values", async () => {
      const order = await createTestOrder();

      const methods = [
        "razorpay",
        "cod",
        "upi",
        "card",
        "netbanking",
        "wallet",
      ] as const;

      for (const method of methods) {
        const [payment] = await db
          .insert(payments)
          .values({
            orderId: order.id,
            amount: 100.0,
            method,
            status: "pending",
          })
          .returning();

        expect(payment.method).toBe(method);
      }
    });
  });

  describe("Razorpay Payment ID Uniqueness", () => {
    it("should enforce unique razorpay_payment_id constraint", async () => {
      const order1 = await createTestOrder();
      const order2 = await createTestOrder();

      await db.insert(payments).values({
        orderId: order1.id,
        razorpayPaymentId: "pay_unique",
        amount: 1000.0,
        method: "razorpay",
      });

      await expect(
        db.insert(payments).values({
          orderId: order2.id,
          razorpayPaymentId: "pay_unique",
          amount: 2000.0,
          method: "razorpay",
        }),
      ).rejects.toThrow();
    });

    it("should allow null razorpay_payment_id for COD", async () => {
      const order = await createTestOrder();

      const [payment] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 1000.0,
          method: "cod",
          status: "pending",
        })
        .returning();

      expect(payment.razorpayPaymentId).toBeNull();
    });
  });

  describe("Multiple Payments per Order", () => {
    it("should allow multiple payments for the same order (partial payments)", async () => {
      const order = await createTestOrder();

      const [payment1] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 500.0,
          method: "card",
          status: "captured",
        })
        .returning();

      const [payment2] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 730.0,
          method: "upi",
          status: "captured",
        })
        .returning();

      expect(payment1.orderId).toBe(order.id);
      expect(payment2.orderId).toBe(order.id);
      expect(payment1.amount + payment2.amount).toBe(1230.0);
    });
  });

  describe("Query Operations", () => {
    it("should find payments by order_id", async () => {
      const order1 = await createTestOrder();
      const order2 = await createTestOrder();

      await db.insert(payments).values({
        orderId: order1.id,
        amount: 1000.0,
        method: "razorpay",
      });

      await db.insert(payments).values({
        orderId: order1.id,
        amount: 230.0,
        method: "cod",
      });

      await db.insert(payments).values({
        orderId: order2.id,
        amount: 500.0,
        method: "card",
      });

      const order1Payments = await db
        .select()
        .from(payments)
        .where(eq(payments.orderId, order1.id));

      expect(order1Payments.length).toBe(2);
      expect(order1Payments.every((p) => p.orderId === order1.id)).toBe(true);
    });

    it("should find payments by status", async () => {
      const order = await createTestOrder();

      await db.insert(payments).values({
        orderId: order.id,
        amount: 1000.0,
        method: "razorpay",
        status: "pending",
      });

      await db.insert(payments).values({
        orderId: order.id,
        amount: 230.0,
        method: "cod",
        status: "captured",
      });

      const pendingPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.status, "pending"));

      expect(pendingPayments.length).toBeGreaterThan(0);
      expect(pendingPayments.every((p) => p.status === "pending")).toBe(true);
    });

    it("should find payment by razorpay_payment_id", async () => {
      const order = await createTestOrder();

      await db.insert(payments).values({
        orderId: order.id,
        razorpayPaymentId: "pay_find_me",
        amount: 1000.0,
        method: "razorpay",
      });

      const [found] = await db
        .select()
        .from(payments)
        .where(eq(payments.razorpayPaymentId, "pay_find_me"));

      expect(found).toBeDefined();
      expect(found?.razorpayPaymentId).toBe("pay_find_me");
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const order = await createTestOrder();

      const [payment] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 1000.0,
          method: "razorpay",
        })
        .returning();

      expect(payment.createdAt).toBeInstanceOf(Date);
      expect(payment.updatedAt).toBeInstanceOf(Date);
      expect(payment.createdAt.getTime()).toBeGreaterThan(0);
      expect(payment.updatedAt.getTime()).toBeGreaterThan(0);
    });

    it("should update updatedAt on modification", async () => {
      const order = await createTestOrder();

      const [inserted] = await db
        .insert(payments)
        .values({
          orderId: order.id,
          amount: 1000.0,
          method: "razorpay",
        })
        .returning();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(payments)
        .set({ status: "captured" })
        .where(eq(payments.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });

  describe("Restrict Delete", () => {
    it("should prevent deleting order when payment exists", async () => {
      const order = await createTestOrder();

      await db.insert(payments).values({
        orderId: order.id,
        amount: 1000.0,
        method: "razorpay",
      });

      // Attempting to delete order should fail due to restrict constraint
      await expect(
        db.delete(orders).where(eq(orders.id, order.id)),
      ).rejects.toThrow();
    });
  });
});
