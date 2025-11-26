import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { randomEmail, randomPhone, randomPinCode } from "../test-utils/helpers";
import { addresses } from "./addresses";
import { customers } from "./customers";
import { orders } from "./orders";
import { shipments } from "./shipments";
import { users } from "./users";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Shipments Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(shipments);
    await db.delete(orders);
    await db.delete(addresses);
    await db.delete(customers);
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(shipments);
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
    it("should create a shipment with valid data", async () => {
      const order = await createTestOrder();

      const [shipment] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR123456789",
          status: "pending",
          labelUrl: "https://example.com/label.pdf",
          awbNumber: "AWB123456",
        })
        .returning();

      expect(shipment).toBeDefined();
      expect(shipment.orderId).toBe(order.id);
      expect(shipment.provider).toBe("shiprocket");
      expect(shipment.trackingNumber).toBe("SR123456789");
      expect(shipment.status).toBe("pending");
      expect(shipment.labelUrl).toBe("https://example.com/label.pdf");
      expect(shipment.awbNumber).toBe("AWB123456");
      expect(shipment.id).toBeDefined();
      expect(shipment.createdAt).toBeInstanceOf(Date);
      expect(shipment.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a shipment by id", async () => {
      const order = await createTestOrder();

      const [inserted] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "nimbus_post",
          trackingNumber: "NP987654321",
          status: "in_transit",
        })
        .returning();

      const [found] = await db
        .select()
        .from(shipments)
        .where(eq(shipments.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.trackingNumber).toBe("NP987654321");
      expect(found?.status).toBe("in_transit");
    });

    it("should update a shipment", async () => {
      const order = await createTestOrder();

      const [inserted] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR111",
          status: "pending",
        })
        .returning();

      const [updated] = await db
        .update(shipments)
        .set({
          status: "in_transit",
          trackingNumber: "SR111_UPDATED",
        })
        .where(eq(shipments.id, inserted.id))
        .returning();

      expect(updated?.status).toBe("in_transit");
      expect(updated?.trackingNumber).toBe("SR111_UPDATED");
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete a shipment", async () => {
      const order = await createTestOrder();

      const [inserted] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR_DELETE",
          status: "pending",
        })
        .returning();

      await db.delete(shipments).where(eq(shipments.id, inserted.id));

      const [found] = await db
        .select()
        .from(shipments)
        .where(eq(shipments.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Shipment Status Enum", () => {
    it("should accept all valid status values", async () => {
      const order = await createTestOrder();

      const statuses = [
        "pending",
        "label_generated",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "returned",
        "cancelled",
      ] as const;

      for (const status of statuses) {
        const [shipment] = await db
          .insert(shipments)
          .values({
            orderId: order.id,
            provider: "shiprocket",
            trackingNumber: `TRACK-${status}-${Math.random()}`,
            status,
          })
          .returning();

        expect(shipment.status).toBe(status);
      }
    });

    it("should default to pending status", async () => {
      const order = await createTestOrder();

      const [shipment] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "TRACK-DEFAULT",
        })
        .returning();

      expect(shipment.status).toBe("pending");
    });
  });

  describe("Tracking Number Uniqueness", () => {
    it("should enforce unique tracking_number constraint", async () => {
      const order1 = await createTestOrder();
      const order2 = await createTestOrder();

      await db.insert(shipments).values({
        orderId: order1.id,
        provider: "shiprocket",
        trackingNumber: "TRACK_UNIQUE",
        status: "pending",
      });

      await expect(
        db.insert(shipments).values({
          orderId: order2.id,
          provider: "nimbus_post",
          trackingNumber: "TRACK_UNIQUE",
          status: "pending",
        }),
      ).rejects.toThrow();
    });

    it("should allow null tracking_number initially", async () => {
      const order = await createTestOrder();

      const [shipment] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          status: "pending",
        })
        .returning();

      expect(shipment.trackingNumber).toBeNull();
    });
  });

  describe("AWB Number Uniqueness", () => {
    it("should enforce unique awb_number constraint", async () => {
      const order1 = await createTestOrder();
      const order2 = await createTestOrder();

      await db.insert(shipments).values({
        orderId: order1.id,
        provider: "shiprocket",
        trackingNumber: "TRACK1",
        awbNumber: "AWB_UNIQUE",
        status: "pending",
      });

      await expect(
        db.insert(shipments).values({
          orderId: order2.id,
          provider: "nimbus_post",
          trackingNumber: "TRACK2",
          awbNumber: "AWB_UNIQUE",
          status: "pending",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Multiple Shipments per Order", () => {
    it("should allow multiple shipments for the same order (split shipments)", async () => {
      const order = await createTestOrder();

      const [shipment1] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR_PART1",
          status: "in_transit",
        })
        .returning();

      const [shipment2] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "nimbus_post",
          trackingNumber: "NP_PART2",
          status: "pending",
        })
        .returning();

      expect(shipment1.orderId).toBe(order.id);
      expect(shipment2.orderId).toBe(order.id);
      expect(shipment1.provider).toBe("shiprocket");
      expect(shipment2.provider).toBe("nimbus_post");
    });
  });

  describe("Query Operations", () => {
    it("should find shipments by order_id", async () => {
      const order1 = await createTestOrder();
      const order2 = await createTestOrder();

      await db.insert(shipments).values({
        orderId: order1.id,
        provider: "shiprocket",
        trackingNumber: "SR_ORDER1_1",
        status: "pending",
      });

      await db.insert(shipments).values({
        orderId: order1.id,
        provider: "nimbus_post",
        trackingNumber: "NP_ORDER1_2",
        status: "in_transit",
      });

      await db.insert(shipments).values({
        orderId: order2.id,
        provider: "shiprocket",
        trackingNumber: "SR_ORDER2",
        status: "delivered",
      });

      const order1Shipments = await db
        .select()
        .from(shipments)
        .where(eq(shipments.orderId, order1.id));

      expect(order1Shipments.length).toBe(2);
      expect(order1Shipments.every((s) => s.orderId === order1.id)).toBe(true);
    });

    it("should find shipments by status", async () => {
      const order = await createTestOrder();

      await db.insert(shipments).values({
        orderId: order.id,
        provider: "shiprocket",
        trackingNumber: "SR_PENDING",
        status: "pending",
      });

      await db.insert(shipments).values({
        orderId: order.id,
        provider: "nimbus_post",
        trackingNumber: "NP_DELIVERED",
        status: "delivered",
      });

      const pendingShipments = await db
        .select()
        .from(shipments)
        .where(eq(shipments.status, "pending"));

      expect(pendingShipments.length).toBeGreaterThan(0);
      expect(pendingShipments.every((s) => s.status === "pending")).toBe(true);
    });

    it("should find shipment by tracking_number", async () => {
      const order = await createTestOrder();

      await db.insert(shipments).values({
        orderId: order.id,
        provider: "shiprocket",
        trackingNumber: "TRACK_FIND_ME",
        status: "in_transit",
      });

      const [found] = await db
        .select()
        .from(shipments)
        .where(eq(shipments.trackingNumber, "TRACK_FIND_ME"));

      expect(found).toBeDefined();
      expect(found?.trackingNumber).toBe("TRACK_FIND_ME");
    });

    it("should find shipments by provider", async () => {
      const order = await createTestOrder();

      await db.insert(shipments).values({
        orderId: order.id,
        provider: "shiprocket",
        trackingNumber: "SR_PROVIDER",
        status: "pending",
      });

      await db.insert(shipments).values({
        orderId: order.id,
        provider: "nimbus_post",
        trackingNumber: "NP_PROVIDER",
        status: "pending",
      });

      const shiprocketShipments = await db
        .select()
        .from(shipments)
        .where(eq(shipments.provider, "shiprocket"));

      expect(shiprocketShipments.length).toBeGreaterThan(0);
      expect(
        shiprocketShipments.every((s) => s.provider === "shiprocket"),
      ).toBe(true);
    });
  });

  describe("Optional Fields", () => {
    it("should allow null label_url", async () => {
      const order = await createTestOrder();

      const [shipment] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR_NO_LABEL",
          status: "pending",
        })
        .returning();

      expect(shipment.labelUrl).toBeNull();
    });

    it("should allow null awb_number", async () => {
      const order = await createTestOrder();

      const [shipment] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR_NO_AWB",
          status: "pending",
        })
        .returning();

      expect(shipment.awbNumber).toBeNull();
    });

    it("should store label_url when provided", async () => {
      const order = await createTestOrder();

      const [shipment] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR_WITH_LABEL",
          labelUrl: "https://example.com/shipping-label.pdf",
          status: "label_generated",
        })
        .returning();

      expect(shipment.labelUrl).toBe("https://example.com/shipping-label.pdf");
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const order = await createTestOrder();

      const [shipment] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR_TIMESTAMP",
          status: "pending",
        })
        .returning();

      expect(shipment.createdAt).toBeInstanceOf(Date);
      expect(shipment.updatedAt).toBeInstanceOf(Date);
      expect(shipment.createdAt.getTime()).toBeGreaterThan(0);
      expect(shipment.updatedAt.getTime()).toBeGreaterThan(0);
    });

    it("should update updatedAt on modification", async () => {
      const order = await createTestOrder();

      const [inserted] = await db
        .insert(shipments)
        .values({
          orderId: order.id,
          provider: "shiprocket",
          trackingNumber: "SR_UPDATE",
          status: "pending",
        })
        .returning();

      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(shipments)
        .set({ status: "in_transit" })
        .where(eq(shipments.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });

  describe("Restrict Delete", () => {
    it("should prevent deleting order when shipment exists", async () => {
      const order = await createTestOrder();

      await db.insert(shipments).values({
        orderId: order.id,
        provider: "shiprocket",
        trackingNumber: "SR_RESTRICT",
        status: "pending",
      });

      // Attempting to delete order should fail due to restrict constraint
      await expect(
        db.delete(orders).where(eq(orders.id, order.id)),
      ).rejects.toThrow();
    });
  });
});
