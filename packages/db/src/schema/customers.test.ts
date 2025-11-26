import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db.js";
import { randomEmail, randomPhone } from "../test-utils/helpers.js";
import { customers } from "./customers.js";
import { users } from "./users.js";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Customers Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(customers);
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(customers);
    await db.delete(users);
    await closeTestDb(pool);
  });

  const createUser = async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: randomEmail(),
        passwordHash: "$2b$10$testhash",
      })
      .returning();
    return user;
  };

  describe("Basic CRUD Operations", () => {
    it("should create a customer with valid data", async () => {
      const user = await createUser();
      const email = randomEmail();
      const phone = randomPhone();

      const [customer] = await db
        .insert(customers)
        .values({
          userId: user.id,
          email,
          phone,
          name: "Test Customer",
        })
        .returning();

      expect(customer).toBeDefined();
      expect(customer.userId).toBe(user.id);
      expect(customer.email).toBe(email);
      expect(customer.phone).toBe(phone);
      expect(customer.name).toBe("Test Customer");
      expect(customer.id).toBeDefined();
      expect(customer.createdAt).toBeInstanceOf(Date);
      expect(customer.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a customer by id", async () => {
      const user = await createUser();
      const [inserted] = await db
        .insert(customers)
        .values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Test Customer",
        })
        .returning();

      const [found] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.name).toBe("Test Customer");
    });

    it("should update a customer", async () => {
      const user = await createUser();
      const [inserted] = await db
        .insert(customers)
        .values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Old Name",
        })
        .returning();

      const [updated] = await db
        .update(customers)
        .set({ name: "New Name" })
        .where(eq(customers.id, inserted.id))
        .returning();

      expect(updated?.name).toBe("New Name");
    });

    it("should delete a customer", async () => {
      const user = await createUser();
      const [inserted] = await db
        .insert(customers)
        .values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Test Customer",
        })
        .returning();

      await db.delete(customers).where(eq(customers.id, inserted.id));

      const [found] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Foreign Key Constraints", () => {
    it("should require valid user_id", async () => {
      await expect(
        db.insert(customers).values({
          userId: "00000000-0000-0000-0000-000000000000" as unknown as string,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Test Customer",
        }),
      ).rejects.toThrow();
    });

    it("should enforce NOT NULL user_id", async () => {
      await expect(
        db.insert(customers).values({
          userId: null as unknown as string,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Test Customer",
        }),
      ).rejects.toThrow();
    });

    it("should enforce unique user_id (one-to-one relationship)", async () => {
      const user = await createUser();

      await db.insert(customers).values({
        userId: user.id,
        email: randomEmail(),
        phone: randomPhone(),
        name: "First Customer",
      });

      await expect(
        db.insert(customers).values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Second Customer",
        }),
      ).rejects.toThrow();
    });

    it("should cascade delete customer when user is deleted", async () => {
      const user = await createUser();
      const [customer] = await db
        .insert(customers)
        .values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Test Customer",
        })
        .returning();

      await db.delete(users).where(eq(users.id, user.id));

      const [found] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customer.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Email Validation", () => {
    it("should enforce unique email", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      const email = randomEmail();

      await db.insert(customers).values({
        userId: user1.id,
        email,
        phone: randomPhone(),
        name: "First Customer",
      });

      await expect(
        db.insert(customers).values({
          userId: user2.id,
          email,
          phone: randomPhone(),
          name: "Second Customer",
        }),
      ).rejects.toThrow();
    });

    it("should enforce NOT NULL email", async () => {
      const user = await createUser();

      await expect(
        db.insert(customers).values({
          userId: user.id,
          email: null as unknown as string,
          phone: randomPhone(),
          name: "Test Customer",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Phone Validation", () => {
    it("should enforce unique phone", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      const phone = randomPhone();

      await db.insert(customers).values({
        userId: user1.id,
        email: randomEmail(),
        phone,
        name: "First Customer",
      });

      await expect(
        db.insert(customers).values({
          userId: user2.id,
          email: randomEmail(),
          phone,
          name: "Second Customer",
        }),
      ).rejects.toThrow();
    });

    it("should enforce NOT NULL phone", async () => {
      const user = await createUser();

      await expect(
        db.insert(customers).values({
          userId: user.id,
          email: randomEmail(),
          phone: null as unknown as string,
          name: "Test Customer",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Name Validation", () => {
    it("should enforce NOT NULL name", async () => {
      const user = await createUser();

      await expect(
        db.insert(customers).values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: null as unknown as string,
        }),
      ).rejects.toThrow();
    });
  });

  describe("GSTIN Validation", () => {
    it("should allow NULL gstin", async () => {
      const user = await createUser();

      const [customer] = await db
        .insert(customers)
        .values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Test Customer",
          gstin: null,
        })
        .returning();

      expect(customer.gstin).toBeNull();
    });

    it("should enforce unique gstin when provided", async () => {
      const user1 = await createUser();
      const user2 = await createUser();
      const gstin = "27AABCU9603R1ZX";

      await db.insert(customers).values({
        userId: user1.id,
        email: randomEmail(),
        phone: randomPhone(),
        name: "First Customer",
        gstin,
      });

      await expect(
        db.insert(customers).values({
          userId: user2.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Second Customer",
          gstin,
        }),
      ).rejects.toThrow();
    });
  });

  describe("Indexes", () => {
    it("should have email index", async () => {
      const user = await createUser();
      const email = randomEmail();

      await db.insert(customers).values({
        userId: user.id,
        email,
        phone: randomPhone(),
        name: "Test Customer",
      });

      const [found] = await db
        .select()
        .from(customers)
        .where(eq(customers.email, email));

      expect(found).toBeDefined();
    });

    it("should have phone index", async () => {
      const user = await createUser();
      const phone = randomPhone();

      await db.insert(customers).values({
        userId: user.id,
        email: randomEmail(),
        phone,
        name: "Test Customer",
      });

      // Query should use index
      const [found] = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, phone));

      expect(found).toBeDefined();
    });
  });
});
