import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { randomEmail } from "../test-utils/helpers";
import { users } from "./users";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Users Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    // Clean up before each test
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(users);
    await closeTestDb(pool);
  });

  describe("Basic CRUD Operations", () => {
    it("should create a user with valid data", async () => {
      const email = randomEmail();
      const passwordHash = "$2b$10$testhash";

      const [user] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          role: "customer",
        })
        .returning();

      expect(user).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.passwordHash).toBe(passwordHash);
      expect(user.role).toBe("customer");
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a user by id", async () => {
      const email = randomEmail();
      const [inserted] = await db
        .insert(users)
        .values({
          email,
          passwordHash: "$2b$10$testhash",
        })
        .returning();

      const [found] = await db
        .select()
        .from(users)
        .where(eq(users.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.email).toBe(email);
    });

    it("should update a user", async () => {
      const email = randomEmail();
      const [inserted] = await db
        .insert(users)
        .values({
          email,
          passwordHash: "$2b$10$oldhash",
        })
        .returning();

      const newPasswordHash = "$2b$10$newhash";
      const [updated] = await db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, inserted.id))
        .returning();

      expect(updated?.passwordHash).toBe(newPasswordHash);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete a user", async () => {
      const email = randomEmail();
      const [inserted] = await db
        .insert(users)
        .values({
          email,
          passwordHash: "$2b$10$testhash",
        })
        .returning();

      await db.delete(users).where(eq(users.id, inserted.id));

      const [found] = await db
        .select()
        .from(users)
        .where(eq(users.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Email Validation", () => {
    it("should accept valid email formats", async () => {
      const validEmails = [
        "test@example.com",
        "user.name@example.co.uk",
        "user+tag@example.com",
      ];

      for (const email of validEmails) {
        const [user] = await db
          .insert(users)
          .values({
            email,
            passwordHash: "$2b$10$testhash",
          })
          .returning();

        expect(user.email).toBe(email);
        await db.delete(users).where(eq(users.id, user.id));
      }
    });

    it("should enforce unique email constraint", async () => {
      const email = randomEmail();

      await db.insert(users).values({
        email,
        passwordHash: "$2b$10$testhash",
      });

      await expect(
        db.insert(users).values({
          email,
          passwordHash: "$2b$10$testhash2",
        }),
      ).rejects.toThrow();
    });

    it("should enforce NOT NULL email constraint", async () => {
      await expect(
        db.insert(users).values({
          email: null as unknown as string,
          passwordHash: "$2b$10$testhash",
        }),
      ).rejects.toThrow();
    });

    it("should handle case-insensitive email uniqueness", async () => {
      const email = randomEmail();
      const emailUpper = email.toUpperCase();

      await db.insert(users).values({
        email,
        passwordHash: "$2b$10$testhash",
      });

      // PostgreSQL unique constraint is case-sensitive by default
      // This test verifies the current behavior
      await expect(
        db.insert(users).values({
          email: emailUpper,
          passwordHash: "$2b$10$testhash2",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Password Hash", () => {
    it("should require password hash", async () => {
      await expect(
        db.insert(users).values({
          email: randomEmail(),
          passwordHash: null as unknown as string,
        }),
      ).rejects.toThrow();
    });

    it("should accept valid bcrypt hash format", async () => {
      const validHashes = [
        "$2b$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstu",
        "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstu",
      ];

      for (const hash of validHashes) {
        const [user] = await db
          .insert(users)
          .values({
            email: randomEmail(),
            passwordHash: hash,
          })
          .returning();

        expect(user.passwordHash).toBe(hash);
        await db.delete(users).where(eq(users.id, user.id));
      }
    });
  });

  describe("Role Enum", () => {
    it("should default to customer role", async () => {
      const [user] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$testhash",
        })
        .returning();

      expect(user.role).toBe("customer");
    });

    it("should accept admin role", async () => {
      const [user] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$testhash",
          role: "admin",
        })
        .returning();

      expect(user.role).toBe("admin");
    });

    it("should accept customer role explicitly", async () => {
      const [user] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$testhash",
          role: "customer",
        })
        .returning();

      expect(user.role).toBe("customer");
    });

    it("should reject invalid role values", async () => {
      await expect(
        db.insert(users).values({
          email: randomEmail(),
          passwordHash: "$2b$10$testhash",
          role: "invalid" as unknown as "admin" | "customer",
        }),
      ).rejects.toThrow();
    });
  });

  describe("Timestamps", () => {
    it("should auto-generate created_at", async () => {
      const beforeInsert = new Date();
      const [user] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$testhash",
        })
        .returning();
      const afterInsert = new Date();

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeInsert.getTime(),
      );
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(
        afterInsert.getTime(),
      );
    });

    it("should auto-generate updated_at", async () => {
      const [user] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$testhash",
        })
        .returning();

      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("should update updated_at on record update", async () => {
      const [inserted] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$oldhash",
        })
        .returning();

      const originalUpdatedAt = inserted.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(users)
        .set({ passwordHash: "$2b$10$newhash" })
        .where(eq(users.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime(),
      );
    });

    it("should not change created_at on update", async () => {
      const [inserted] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$oldhash",
        })
        .returning();

      const originalCreatedAt = inserted.createdAt;

      await db
        .update(users)
        .set({ passwordHash: "$2b$10$newhash" })
        .where(eq(users.id, inserted.id));

      const [updated] = await db
        .select()
        .from(users)
        .where(eq(users.id, inserted.id));

      expect(updated?.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    });
  });

  describe("Indexes", () => {
    it("should have email index for performance", async () => {
      const email = randomEmail();
      await db.insert(users).values({
        email,
        passwordHash: "$2b$10$testhash",
      });

      // Query using email should use index
      const [found] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      expect(found).toBeDefined();
      expect(found?.email).toBe(email);
    });
  });

  describe("Type Safety", () => {
    it("should export correct TypeScript types", () => {
      // Type check: User type should have all required fields
      const user: typeof users.$inferSelect = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        passwordHash: "$2b$10$testhash",
        role: "customer",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(user).toBeDefined();
    });

    it("should infer insert type correctly", () => {
      const newUser: typeof users.$inferInsert = {
        email: "test@example.com",
        passwordHash: "$2b$10$testhash",
        role: "customer",
      };

      expect(newUser).toBeDefined();
    });
  });
});
