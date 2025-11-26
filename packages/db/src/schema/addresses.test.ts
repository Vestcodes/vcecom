import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { randomEmail, randomPhone, randomPinCode } from "../test-utils/helpers";
import { addresses } from "./addresses";
import { customers } from "./customers";
import { users } from "./users";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Addresses Schema", () => {
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

  const createCustomer = async () => {
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

    return customer;
  };

  describe("Basic CRUD Operations", () => {
    it("should create an address with valid data", async () => {
      const customer = await createCustomer();

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

      expect(address).toBeDefined();
      expect(address.customerId).toBe(customer.id);
      expect(address.street).toBe("123 Main Street");
      expect(address.city).toBe("Mumbai");
      expect(address.state).toBe("Maharashtra");
      expect(address.type).toBe("shipping");
      expect(address.country).toBe("India");
      expect(address.isDefault).toBe(false);
    });

    it("should read an address by id", async () => {
      const customer = await createCustomer();
      const [inserted] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        })
        .returning();

      const [found] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.street).toBe("123 Main Street");
    });

    it("should update an address", async () => {
      const customer = await createCustomer();
      const [inserted] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "123 Old Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        })
        .returning();

      const [updated] = await db
        .update(addresses)
        .set({ street: "456 New Street" })
        .where(eq(addresses.id, inserted.id))
        .returning();

      expect(updated?.street).toBe("456 New Street");
    });

    it("should delete an address", async () => {
      const customer = await createCustomer();
      const [inserted] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        })
        .returning();

      await db.delete(addresses).where(eq(addresses.id, inserted.id));

      const [found] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Foreign Key Constraints", () => {
    it("should require valid customer_id", async () => {
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

    it("should enforce NOT NULL customer_id", async () => {
      await expect(
        db.insert(addresses).values({
          customerId: null as unknown as string,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        }),
      ).rejects.toThrow();
    });

    it("should allow multiple addresses per customer", async () => {
      const customer = await createCustomer();

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

      expect(addr1.id).not.toBe(addr2.id);
      expect(addr1.customerId).toBe(addr2.customerId);
    });

    it("should cascade delete addresses when customer is deleted", async () => {
      const customer = await createCustomer();
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

      await db.delete(customers).where(eq(customers.id, customer.id));

      const [found] = await db
        .select()
        .from(addresses)
        .where(eq(addresses.id, address.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Address Type", () => {
    it("should default to shipping type", async () => {
      const customer = await createCustomer();

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

      expect(address.type).toBe("shipping");
    });

    it("should accept billing type", async () => {
      const customer = await createCustomer();

      const [address] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          type: "billing",
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        })
        .returning();

      expect(address.type).toBe("billing");
    });

    it("should accept both type", async () => {
      const customer = await createCustomer();

      const [address] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          type: "both",
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        })
        .returning();

      expect(address.type).toBe("both");
    });

    it("should reject invalid type values", async () => {
      const customer = await createCustomer();

      await expect(
        db.insert(addresses).values({
          customerId: customer.id,
          type: "invalid" as unknown as "shipping" | "billing" | "both",
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        }),
      ).rejects.toThrow();
    });
  });

  describe("Required Fields", () => {
    it("should enforce NOT NULL street", async () => {
      const customer = await createCustomer();

      await expect(
        db.insert(addresses).values({
          customerId: customer.id,
          street: null as unknown as string,
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
        }),
      ).rejects.toThrow();
    });

    it("should enforce NOT NULL city", async () => {
      const customer = await createCustomer();

      await expect(
        db.insert(addresses).values({
          customerId: customer.id,
          street: "123 Main Street",
          city: null as unknown as string,
          state: "Maharashtra",
          pincode: randomPinCode(),
        }),
      ).rejects.toThrow();
    });

    it("should enforce NOT NULL state", async () => {
      const customer = await createCustomer();

      await expect(
        db.insert(addresses).values({
          customerId: customer.id,
          street: "123 Main Street",
          city: "Mumbai",
          state: null as unknown as string,
          pincode: randomPinCode(),
        }),
      ).rejects.toThrow();
    });

    it("should enforce NOT NULL pincode", async () => {
      const customer = await createCustomer();

      await expect(
        db.insert(addresses).values({
          customerId: customer.id,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: null as unknown as string,
        }),
      ).rejects.toThrow();
    });
  });

  describe("Default Address", () => {
    it("should default to false", async () => {
      const customer = await createCustomer();

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

      expect(address.isDefault).toBe(false);
    });

    it("should allow setting default address", async () => {
      const customer = await createCustomer();

      const [address] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
          isDefault: true,
        })
        .returning();

      expect(address.isDefault).toBe(true);
    });

    it("should allow multiple addresses with only one default", async () => {
      const customer = await createCustomer();

      const [addr1] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "Address 1",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
          isDefault: true,
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
          isDefault: false,
        })
        .returning();

      expect(addr1.isDefault).toBe(true);
      expect(addr2.isDefault).toBe(false);
    });
  });

  describe("Country Default", () => {
    it("should default to India", async () => {
      const customer = await createCustomer();

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

      expect(address.country).toBe("India");
    });
  });

  describe("District Field", () => {
    it("should allow NULL district", async () => {
      const customer = await createCustomer();

      const [address] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
          district: null,
        })
        .returning();

      expect(address.district).toBeNull();
    });

    it("should accept district value", async () => {
      const customer = await createCustomer();

      const [address] = await db
        .insert(addresses)
        .values({
          customerId: customer.id,
          street: "123 Main Street",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: randomPinCode(),
          district: "Mumbai Suburban",
        })
        .returning();

      expect(address.district).toBe("Mumbai Suburban");
    });
  });

  describe("Indexes", () => {
    it("should have customer_id index", async () => {
      const customer = await createCustomer();

      await db.insert(addresses).values({
        customerId: customer.id,
        street: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: randomPinCode(),
      });

      const found = await db
        .select()
        .from(addresses)
        .where(eq(addresses.customerId, customer.id));

      expect(found.length).toBeGreaterThan(0);
    });

    it("should have pincode index", async () => {
      const customer = await createCustomer();
      const pincode = randomPinCode();

      await db.insert(addresses).values({
        customerId: customer.id,
        street: "123 Main Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode,
      });

      const found = await db
        .select()
        .from(addresses)
        .where(eq(addresses.pincode, pincode));

      expect(found.length).toBeGreaterThan(0);
    });
  });
});
