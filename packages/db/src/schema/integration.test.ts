import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { randomEmail, randomPhone, randomPinCode } from "../test-utils/helpers";
import { addresses } from "./addresses";
import { customers } from "./customers";
import { users } from "./users";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Schema Integration Tests", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(addresses);
    await db.delete(customers);
    await db.delete(users);
  });

  afterEach(async () => {
    await db.delete(addresses);
    await db.delete(customers);
    await db.delete(users);
    await closeTestDb(pool);
  });

  describe("User → Customer → Addresses Cascade", () => {
    it("should cascade delete customer and addresses when user is deleted", async () => {
      // Create user
      const [user] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$testhash",
        })
        .returning();

      // Create customer
      const [customer] = await db
        .insert(customers)
        .values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Test Customer",
        })
        .returning();

      // Create addresses
      const [addr1] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "Address 1",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        })
        .returning();

      const [addr2] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "Address 2",
          city: "Delhi",
          state: "Delhi",
          pincode: randomPinCode(),
        })
        .returning();

      // Delete user - should cascade delete customer and addresses
      await db.delete(users).where(eq(users.id, user.id));

      // Verify customer is deleted
      const [foundCustomer] = await db
        .select()
        .from(customers)
        .where(eq(customers.id, customer.id));
      expect(foundCustomer).toBeUndefined();

      // Verify addresses are deleted
      const [foundAddr1] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, addr1.id));
      expect(foundAddr1).toBeUndefined();

      const [foundAddr2] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, addr2.id));
      expect(foundAddr2).toBeUndefined();
    });

    it("should cascade delete addresses when customer is deleted", async () => {
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

      const [address] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        })
        .returning();

      // Delete customer - should cascade delete address
      await db.delete(customers).where(eq(customers.id, customer.id));

      // Verify address is deleted
      const [found] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, address.id));
      expect(found).toBeUndefined();
    });
  });

  describe("Complex Queries", () => {
    it("should join user, customer, and addresses", async () => {
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

      await db.insert(addresses).values({
        customerId: customer.id,
        street: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: randomPinCode(),
      });

      // Query customer with user
      const customerWithUser = await db
        .select({
          customer: customers,
          user: users,
        })
        .from(customers)
        .innerJoin(users, eq(customers.userId, users.id))
        .where(eq(customers.id, customer.id));

      expect(customerWithUser.length).toBe(1);
      expect(customerWithUser[0]?.customer.id).toBe(customer.id);
      expect(customerWithUser[0]?.user.id).toBe(user.id);
    });

    it("should query addresses by customer", async () => {
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

      await db.insert(addresses).values({
        customerId: customer.id,
        street: "Address 1",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: randomPinCode(),
      });

      await db.insert(addresses).values({
        customerId: customer.id,
        street: "Address 2",
        city: "Delhi",
        state: "Delhi",
        pincode: randomPinCode(),
      });

      const customerAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.customerId, customer.id));

      expect(customerAddresses.length).toBe(2);
    });

    it("should query default addresses only", async () => {
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

      await db.insert(addresses).values({
        customerId: customer.id,
        street: "Non-default Address",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: randomPinCode(),
        isDefault: false,
      });

      const [defaultAddr] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "Default Address",
          city: "Delhi",
          state: "Delhi",
          pincode: randomPinCode(),
          isDefault: true,
        })
        .returning();

      const defaultAddresses = await db
        .select()
        .from(addresses)
        .where(eq(addresses.customerId, customer.id))
        .where(eq(addresses.isDefault, true));

      expect(defaultAddresses.length).toBe(1);
      expect(defaultAddresses[0]?.id).toBe(defaultAddr.id);
    });
  });

  describe("Data Integrity", () => {
    it("should maintain referential integrity", async () => {
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

      // Try to create address with invalid customer_id should fail
      await expect(
        db.insert(addresses).values({
          customerId:
            "00000000-0000-0000-0000-000000000000" as unknown as string,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        }),
      ).rejects.toThrow();
    });

    it("should enforce one-to-one relationship between user and customer", async () => {
      const [user] = await db
        .insert(users)
        .values({
          email: randomEmail(),
          passwordHash: "$2b$10$testhash",
        })
        .returning();

      await db.insert(customers).values({
        userId: user.id,
        email: randomEmail(),
        phone: randomPhone(),
        name: "First Customer",
      });

      // Try to create second customer for same user should fail
      await expect(
        db.insert(customers).values({
          userId: user.id,
          email: randomEmail(),
          phone: randomPhone(),
          name: "Second Customer",
        }),
      ).rejects.toThrow();
    });
  });
});
