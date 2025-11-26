import { eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { randomEmail, randomPhone } from "../test-utils/helpers";
import { carts } from "./carts";
import { customers } from "./customers";
import { users } from "./users";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Carts Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(carts);
    await db.delete(customers);
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(carts);
    await db.delete(customers);
    await db.delete(users);
    await closeTestDb(pool);
  });

  describe("Basic CRUD Operations", () => {
    it("should create a cart with session_id", async () => {
      const [cart] = await db
        .insert(carts)
        .values({
          sessionId: "test-session-123",
          subtotal: 100.0,
          gstAmount: 18.0,
          total: 118.0,
        })
        .returning();

      expect(cart).toBeDefined();
      expect(cart.sessionId).toBe("test-session-123");
      expect(cart.subtotal).toBe(100.0);
      expect(cart.gstAmount).toBe(18.0);
      expect(cart.total).toBe(118.0);
      expect(cart.customerId).toBeNull();
      expect(cart.id).toBeDefined();
      expect(cart.createdAt).toBeInstanceOf(Date);
      expect(cart.updatedAt).toBeInstanceOf(Date);
    });

    it("should create a cart with customer_id", async () => {
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

      const [cart] = await db
        .insert(carts)
        .values({
          customerId: customer.id,
          subtotal: 200.0,
          gstAmount: 36.0,
          total: 236.0,
        })
        .returning();

      expect(cart).toBeDefined();
      expect(cart.customerId).toBe(customer.id);
      expect(cart.subtotal).toBe(200.0);
      expect(cart.gstAmount).toBe(36.0);
      expect(cart.total).toBe(236.0);
    });

    it("should read a cart by id", async () => {
      const [inserted] = await db
        .insert(carts)
        .values({
          sessionId: "test-session-456",
          subtotal: 150.0,
          gstAmount: 27.0,
          total: 177.0,
        })
        .returning();

      const [found] = await db
        .select()
        .from(carts)
        .where(eq(carts.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.sessionId).toBe("test-session-456");
      expect(found?.subtotal).toBe(150.0);
    });

    it("should update a cart", async () => {
      const [inserted] = await db
        .insert(carts)
        .values({
          sessionId: "test-session-789",
          subtotal: 100.0,
          gstAmount: 18.0,
          total: 118.0,
        })
        .returning();

      const [updated] = await db
        .update(carts)
        .set({ subtotal: 200.0, gstAmount: 36.0, total: 236.0 })
        .where(eq(carts.id, inserted.id))
        .returning();

      expect(updated?.subtotal).toBe(200.0);
      expect(updated?.gstAmount).toBe(36.0);
      expect(updated?.total).toBe(236.0);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete a cart", async () => {
      const [inserted] = await db
        .insert(carts)
        .values({
          sessionId: "test-session-delete",
          subtotal: 100.0,
          gstAmount: 18.0,
          total: 118.0,
        })
        .returning();

      await db.delete(carts).where(eq(carts.id, inserted.id));

      const [found] = await db
        .select()
        .from(carts)
        .where(eq(carts.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Session ID Uniqueness", () => {
    it("should enforce unique session_id constraint", async () => {
      await db.insert(carts).values({
        sessionId: "unique-session",
        subtotal: 100.0,
        gstAmount: 18.0,
        total: 118.0,
      });

      await expect(
        db.insert(carts).values({
          sessionId: "unique-session",
          subtotal: 200.0,
          gstAmount: 36.0,
          total: 236.0,
        }),
      ).rejects.toThrow();
    });

    it("should allow null session_id for multiple carts", async () => {
      await db.insert(carts).values({
        subtotal: 100.0,
        gstAmount: 18.0,
        total: 118.0,
      });

      const [cart2] = await db
        .insert(carts)
        .values({
          subtotal: 200.0,
          gstAmount: 36.0,
          total: 236.0,
        })
        .returning();

      expect(cart2).toBeDefined();
      expect(cart2.sessionId).toBeNull();
    });
  });

  describe("Default Values", () => {
    it("should set default values for subtotal, gstAmount, and total", async () => {
      const [cart] = await db
        .insert(carts)
        .values({
          sessionId: "test-defaults",
        })
        .returning();

      expect(cart.subtotal).toBe(0);
      expect(cart.gstAmount).toBe(0);
      expect(cart.total).toBe(0);
    });

    it("should allow null expires_at", async () => {
      const [cart] = await db
        .insert(carts)
        .values({
          sessionId: "test-no-expiry",
          subtotal: 100.0,
          gstAmount: 18.0,
          total: 118.0,
        })
        .returning();

      expect(cart.expiresAt).toBeNull();
    });

    it("should store expires_at when provided", async () => {
      const expiryDate = new Date("2025-12-31T23:59:59Z");
      const [cart] = await db
        .insert(carts)
        .values({
          sessionId: "test-expiry",
          subtotal: 100.0,
          gstAmount: 18.0,
          total: 118.0,
          expiresAt: expiryDate,
        })
        .returning();

      expect(cart.expiresAt).toBeInstanceOf(Date);
      expect(cart.expiresAt?.getTime()).toBe(expiryDate.getTime());
    });
  });

  describe("Query Operations", () => {
    it("should find cart by session_id", async () => {
      await db.insert(carts).values({
        sessionId: "session-1",
        subtotal: 100.0,
        gstAmount: 18.0,
        total: 118.0,
      });

      await db.insert(carts).values({
        sessionId: "session-2",
        subtotal: 200.0,
        gstAmount: 36.0,
        total: 236.0,
      });

      const [found] = await db
        .select()
        .from(carts)
        .where(eq(carts.sessionId, "session-1"));

      expect(found).toBeDefined();
      expect(found?.sessionId).toBe("session-1");
      expect(found?.subtotal).toBe(100.0);
    });

    it("should find carts by customer_id", async () => {
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

      await db.insert(carts).values({
        customerId: customer.id,
        subtotal: 100.0,
        gstAmount: 18.0,
        total: 118.0,
      });

      await db.insert(carts).values({
        subtotal: 200.0,
        gstAmount: 36.0,
        total: 236.0,
      });

      const customerCarts = await db
        .select()
        .from(carts)
        .where(eq(carts.customerId, customer.id));

      expect(customerCarts.length).toBe(1);
      expect(customerCarts[0]?.customerId).toBe(customer.id);
    });

    it("should find carts without customer (guest carts)", async () => {
      await db.insert(carts).values({
        sessionId: "guest-1",
        subtotal: 100.0,
        gstAmount: 18.0,
        total: 118.0,
      });

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

      await db.insert(carts).values({
        customerId: customer.id,
        subtotal: 200.0,
        gstAmount: 36.0,
        total: 236.0,
      });

      const guestCarts = await db
        .select()
        .from(carts)
        .where(isNull(carts.customerId));

      expect(guestCarts.length).toBeGreaterThan(0);
      expect(guestCarts.every((c) => c.customerId === null)).toBe(true);
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const [cart] = await db
        .insert(carts)
        .values({
          sessionId: "test-timestamps",
          subtotal: 100.0,
          gstAmount: 18.0,
          total: 118.0,
        })
        .returning();

      expect(cart.createdAt).toBeInstanceOf(Date);
      expect(cart.updatedAt).toBeInstanceOf(Date);
      expect(cart.createdAt.getTime()).toBeGreaterThan(0);
      expect(cart.updatedAt.getTime()).toBeGreaterThan(0);
    });

    it("should update updatedAt on modification", async () => {
      const [inserted] = await db
        .insert(carts)
        .values({
          sessionId: "test-update",
          subtotal: 100.0,
          gstAmount: 18.0,
          total: 118.0,
        })
        .returning();

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(carts)
        .set({ subtotal: 200.0 })
        .where(eq(carts.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });

  describe("Cascade Delete", () => {
    it("should delete cart when customer is deleted", async () => {
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

      const [cart] = await db
        .insert(carts)
        .values({
          customerId: customer.id,
          subtotal: 100.0,
          gstAmount: 18.0,
          total: 118.0,
        })
        .returning();

      await db.delete(customers).where(eq(customers.id, customer.id));

      const [found] = await db
        .select()
        .from(carts)
        .where(eq(carts.id, cart.id));

      expect(found).toBeUndefined();
    });
  });
});
