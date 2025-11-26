import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { randomEmail, randomPhone, randomPinCode } from "../test-utils/helpers";
import { addresses } from "./addresses";
import { customers } from "./customers";
import { orders } from "./orders";
import { users } from "./users";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Orders Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(orders);
    await db.delete(addresses);
    await db.delete(customers);
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(orders);
    await db.delete(addresses);
    await db.delete(customers);
    await db.delete(users);
    await closeTestDb(pool);
  });

  async function createTestCustomerWithAddresses() {
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

    return { customer, shippingAddress, billingAddress };
  }

  describe("Basic CRUD Operations", () => {
    it("should create an order with valid data", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      const [order] = await db
        .insert(orders)
        .values({
          customerId: customer.id,
          orderNumber: "ORD-001",
          status: "pending",
          subtotal: 1000.0,
          gstAmount: 180.0,
          shippingCost: 50.0,
          total: 1230.0,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
        })
        .returning();

      expect(order).toBeDefined();
      expect(order.orderNumber).toBe("ORD-001");
      expect(order.status).toBe("pending");
      expect(order.subtotal).toBe(1000.0);
      expect(order.gstAmount).toBe(180.0);
      expect(order.shippingCost).toBe(50.0);
      expect(order.total).toBe(1230.0);
      expect(order.id).toBeDefined();
      expect(order.createdAt).toBeInstanceOf(Date);
      expect(order.updatedAt).toBeInstanceOf(Date);
    });

    it("should read an order by id", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      const [inserted] = await db
        .insert(orders)
        .values({
          customerId: customer.id,
          orderNumber: "ORD-002",
          subtotal: 500.0,
          gstAmount: 90.0,
          shippingCost: 25.0,
          total: 615.0,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
        })
        .returning();

      const [found] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.orderNumber).toBe("ORD-002");
      expect(found?.total).toBe(615.0);
    });

    it("should update an order", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      const [inserted] = await db
        .insert(orders)
        .values({
          customerId: customer.id,
          orderNumber: "ORD-003",
          status: "pending",
          subtotal: 1000.0,
          gstAmount: 180.0,
          shippingCost: 50.0,
          total: 1230.0,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
        })
        .returning();

      const [updated] = await db
        .update(orders)
        .set({ status: "confirmed", razorpayOrderId: "rzp_123456" })
        .where(eq(orders.id, inserted.id))
        .returning();

      expect(updated?.status).toBe("confirmed");
      expect(updated?.razorpayOrderId).toBe("rzp_123456");
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });

  describe("Order Number Uniqueness", () => {
    it("should enforce unique order_number constraint", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      await db.insert(orders).values({
        customerId: customer.id,
        orderNumber: "ORD-UNIQUE",
        subtotal: 1000.0,
        gstAmount: 180.0,
        shippingCost: 50.0,
        total: 1230.0,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
      });

      await expect(
        db.insert(orders).values({
          customerId: customer.id,
          orderNumber: "ORD-UNIQUE",
          subtotal: 2000.0,
          gstAmount: 360.0,
          shippingCost: 100.0,
          total: 2460.0,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
        }),
      ).rejects.toThrow();
    });
  });

  describe("Order Status Enum", () => {
    it("should accept all valid status values", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      const statuses = [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ] as const;

      for (const status of statuses) {
        const [order] = await db
          .insert(orders)
          .values({
            customerId: customer.id,
            orderNumber: `ORD-${status}-${Math.random()}`,
            status,
            subtotal: 100.0,
            gstAmount: 18.0,
            shippingCost: 10.0,
            total: 128.0,
            shippingAddressId: shippingAddress.id,
            billingAddressId: billingAddress.id,
          })
          .returning();

        expect(order.status).toBe(status);
      }
    });

    it("should default to pending status", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      const [order] = await db
        .insert(orders)
        .values({
          customerId: customer.id,
          orderNumber: "ORD-DEFAULT",
          subtotal: 100.0,
          gstAmount: 18.0,
          shippingCost: 10.0,
          total: 128.0,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
        })
        .returning();

      expect(order.status).toBe("pending");
    });
  });

  describe("Default Values", () => {
    it("should set default values for financial fields", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      const [order] = await db
        .insert(orders)
        .values({
          customerId: customer.id,
          orderNumber: "ORD-DEFAULTS",
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
        })
        .returning();

      expect(order.subtotal).toBe(0);
      expect(order.gstAmount).toBe(0);
      expect(order.shippingCost).toBe(0);
      expect(order.total).toBe(0);
    });
  });

  describe("Query Operations", () => {
    it("should find orders by customer_id", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      await db.insert(orders).values({
        customerId: customer.id,
        orderNumber: "ORD-CUST-1",
        subtotal: 100.0,
        gstAmount: 18.0,
        shippingCost: 10.0,
        total: 128.0,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
      });

      await db.insert(orders).values({
        customerId: customer.id,
        orderNumber: "ORD-CUST-2",
        subtotal: 200.0,
        gstAmount: 36.0,
        shippingCost: 20.0,
        total: 256.0,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
      });

      const customerOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.customerId, customer.id));

      expect(customerOrders.length).toBe(2);
      expect(customerOrders.every((o) => o.customerId === customer.id)).toBe(
        true,
      );
    });

    it("should find orders by status", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      await db.insert(orders).values({
        customerId: customer.id,
        orderNumber: "ORD-PENDING",
        status: "pending",
        subtotal: 100.0,
        gstAmount: 18.0,
        shippingCost: 10.0,
        total: 128.0,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
      });

      await db.insert(orders).values({
        customerId: customer.id,
        orderNumber: "ORD-CONFIRMED",
        status: "confirmed",
        subtotal: 200.0,
        gstAmount: 36.0,
        shippingCost: 20.0,
        total: 256.0,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
      });

      const pendingOrders = await db
        .select()
        .from(orders)
        .where(eq(orders.status, "pending"));

      expect(pendingOrders.length).toBeGreaterThan(0);
      expect(pendingOrders.every((o) => o.status === "pending")).toBe(true);
    });

    it("should find order by order_number", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      await db.insert(orders).values({
        customerId: customer.id,
        orderNumber: "ORD-FIND",
        subtotal: 100.0,
        gstAmount: 18.0,
        shippingCost: 10.0,
        total: 128.0,
        shippingAddressId: shippingAddress.id,
        billingAddressId: billingAddress.id,
      });

      const [found] = await db
        .select()
        .from(orders)
        .where(eq(orders.orderNumber, "ORD-FIND"));

      expect(found).toBeDefined();
      expect(found?.orderNumber).toBe("ORD-FIND");
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      const [order] = await db
        .insert(orders)
        .values({
          customerId: customer.id,
          orderNumber: "ORD-TIMESTAMP",
          subtotal: 100.0,
          gstAmount: 18.0,
          shippingCost: 10.0,
          total: 128.0,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
        })
        .returning();

      expect(order.createdAt).toBeInstanceOf(Date);
      expect(order.updatedAt).toBeInstanceOf(Date);
      expect(order.createdAt.getTime()).toBeGreaterThan(0);
      expect(order.updatedAt.getTime()).toBeGreaterThan(0);
    });

    it("should update updatedAt on modification", async () => {
      const { customer, shippingAddress, billingAddress } =
        await createTestCustomerWithAddresses();

      const [inserted] = await db
        .insert(orders)
        .values({
          customerId: customer.id,
          orderNumber: "ORD-UPDATE",
          subtotal: 100.0,
          gstAmount: 18.0,
          shippingCost: 10.0,
          total: 128.0,
          shippingAddressId: shippingAddress.id,
          billingAddressId: billingAddress.id,
        })
        .returning();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(orders)
        .set({ status: "confirmed" })
        .where(eq(orders.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });
});
