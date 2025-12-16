import { Test, TestingModule } from "@nestjs/testing";
import Redis from "ioredis";
import { InventoryStore } from "./inventory.store";

describe("InventoryStore", () => {
  let store: InventoryStore;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    // Create mock Redis client
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incrby: jest.fn(),
      decrby: jest.fn(),
      keys: jest.fn(),
      mget: jest.fn(),
      expire: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryStore,
        {
          provide: "REDIS_CLIENT",
          useValue: mockRedis,
        },
      ],
    }).compile();

    store = module.get<InventoryStore>(InventoryStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getInventory", () => {
    it("should return cached inventory count", async () => {
      mockRedis.get.mockResolvedValue("100");

      const result = await store.getInventory("variant-123");

      expect(result).toBe(100);
      expect(mockRedis.get).toHaveBeenCalledWith(
        "vcecom:v1:inventory:variant-123",
      );
    });

    it("should return null if not cached", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await store.getInventory("variant-123");

      expect(result).toBeNull();
    });
  });

  describe("setInventory", () => {
    it("should cache inventory count with TTL", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      await store.setInventory("variant-123", 100);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "vcecom:v1:inventory:variant-123",
        3600,
        "100",
      );
    });
  });

  describe("incrementInventory", () => {
    it("should increment inventory atomically", async () => {
      mockRedis.incrby.mockResolvedValue(105);
      mockRedis.expire.mockResolvedValue(1);

      const result = await store.incrementInventory("variant-123", 5);

      expect(result).toBe(105);
      expect(mockRedis.incrby).toHaveBeenCalledWith(
        "vcecom:v1:inventory:variant-123",
        5,
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        "vcecom:v1:inventory:variant-123",
        3600,
      );
    });

    it("should decrement inventory when delta is negative", async () => {
      mockRedis.decrby.mockResolvedValue(95);
      mockRedis.expire.mockResolvedValue(1);

      const result = await store.incrementInventory("variant-123", -5);

      expect(result).toBe(95);
      expect(mockRedis.decrby).toHaveBeenCalledWith(
        "vcecom:v1:inventory:variant-123",
        5,
      );
    });
  });

  describe("reserveInventory", () => {
    it("should reserve inventory when available", async () => {
      mockRedis.get.mockResolvedValue("100"); // current inventory
      mockRedis.keys.mockResolvedValue([
        "vcecom:v1:inventory:reservation:variant-123:res-1",
      ]); // existing reservations
      mockRedis.mget.mockResolvedValue(["10"]); // existing reservation quantity
      mockRedis.setex.mockResolvedValue("OK");

      const result = await store.reserveInventory(
        "variant-123",
        50,
        "reservation-456",
      );

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(
        "vcecom:v1:inventory:variant-123",
      );
      expect(mockRedis.setex).toHaveBeenCalledWith(
        "vcecom:v1:inventory:reservation:variant-123:reservation-456",
        900,
        "50",
      );
    });

    it("should return false when insufficient inventory", async () => {
      mockRedis.get.mockResolvedValue("100"); // current inventory
      mockRedis.keys.mockResolvedValue([
        "vcecom:v1:inventory:reservation:variant-123:res-1",
      ]); // existing reservations
      mockRedis.mget.mockResolvedValue(["60"]); // existing reservation quantity

      const result = await store.reserveInventory(
        "variant-123",
        50,
        "reservation-456",
      );

      expect(result).toBe(false);
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe("releaseReservation", () => {
    it("should delete reservation key", async () => {
      mockRedis.del.mockResolvedValue(1);

      await store.releaseReservation("variant-123", "reservation-456");

      expect(mockRedis.del).toHaveBeenCalledWith(
        "vcecom:v1:inventory:reservation:variant-123:reservation-456",
      );
    });
  });

  describe("getReservedQuantity", () => {
    it("should return total reserved quantity", async () => {
      mockRedis.keys.mockResolvedValue([
        "vcecom:v1:inventory:reservation:variant-123:res-1",
        "vcecom:v1:inventory:reservation:variant-123:res-2",
      ]);
      mockRedis.mget.mockResolvedValue(["10", "20"]);

      const result = await store.getReservedQuantity("variant-123");

      expect(result).toBe(30);
    });

    it("should return 0 when no reservations exist", async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await store.getReservedQuantity("variant-123");

      expect(result).toBe(0);
    });
  });

  describe("invalidateInventory", () => {
    it("should delete inventory cache", async () => {
      mockRedis.del.mockResolvedValue(1);

      await store.invalidateInventory("variant-123");

      expect(mockRedis.del).toHaveBeenCalledWith(
        "vcecom:v1:inventory:variant-123",
      );
    });
  });
});

