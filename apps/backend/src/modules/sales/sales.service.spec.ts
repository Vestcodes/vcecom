import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  db,
  productSales,
  products,
} from "@vcecom/db";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";

// Mock the database
jest.mock("@vcecom/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  productSales: {},
  products: {},
  eq: jest.fn((field, value) => ({ field, value })),
  and: jest.fn((...args) => args),
  or: jest.fn((...args) => args),
  inArray: jest.fn((field, values) => ({ field, values })),
  desc: jest.fn((field) => ({ field, order: "desc" })),
  gte: jest.fn((field, value) => ({ field, value, op: "gte" })),
  lte: jest.fn((field, value) => ({ field, value, op: "lte" })),
  sql: jest.fn((template) => ({ sql: template })),
}));

describe("SalesService", () => {
  let service: SalesService;

  beforeEach(() => {
    service = new SalesService();
    jest.clearAllMocks();
  });

  // Helper to create proper mock chain
  const createSelectChain = (results: unknown[]) => {
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(results),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockResolvedValue(results),
    };
    return chain;
  };

  const createSelectChainWhereOnly = (results: unknown[]) => {
    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(results),
    };
    return chain;
  };

  const createInsertChain = (results: unknown[]) => {
    const returningFn = jest.fn().mockResolvedValue(results);
    const valuesFn = jest.fn().mockReturnValue({ returning: returningFn });
    return { values: valuesFn };
  };

  const createUpdateChain = (results: unknown[]) => {
    const returningFn = jest.fn().mockResolvedValue(results);
    const whereFn = jest.fn().mockReturnValue({ returning: returningFn });
    const setFn = jest.fn().mockReturnValue({ where: whereFn });
    return { set: setFn };
  };

  describe("getEffectivePrice", () => {
    it("should return sale price when active sale exists", async () => {
      const product = {
        id: "product-1",
        price: 100.0,
      };
      const sale = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        status: "active",
        isActive: true,
        priority: 0,
      };

      // Mock: Get product
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([product]),
      );

      // Mock: Get active sale
      const saleChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([sale]),
      };
      (db.select as jest.Mock).mockReturnValueOnce(saleChain);

      const result = await service.getEffectivePrice("product-1");

      expect(result).toBeDefined();
      expect(result.price).toBe(100.0);
      expect(result.salePrice).toBe(79.99);
      expect(result.isOnSale).toBe(true);
      expect(result.saleId).toBe("sale-1");
    });

    it("should return regular price when no active sale exists", async () => {
      const product = {
        id: "product-1",
        price: 100.0,
      };

      // Mock: Get product
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([product]),
      );

      // Mock: No active sale found
      const saleChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      (db.select as jest.Mock).mockReturnValueOnce(saleChain);

      const result = await service.getEffectivePrice("product-1");

      expect(result).toBeDefined();
      expect(result.price).toBe(100.0);
      expect(result.salePrice).toBeNull();
      expect(result.isOnSale).toBe(false);
    });

    it("should throw NotFoundException if product does not exist", async () => {
      // Mock: Product not found
      (db.select as jest.Mock).mockReturnValueOnce(createSelectChain([]));

      await expect(service.getEffectivePrice("product-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getEffectivePricesForProducts", () => {
    it("should return sale prices for multiple products", async () => {
      const product1 = { id: "product-1", price: 100.0 };
      const product2 = { id: "product-2", price: 200.0 };
      const sale1 = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        status: "active",
        isActive: true,
        priority: 0,
      };

      // Mock: Get products
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChainWhereOnly([product1, product2]),
      );

      // Mock: Get active sales
      const saleChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue([sale1]),
      };
      (db.select as jest.Mock).mockReturnValueOnce(saleChain);

      const result = await service.getEffectivePricesForProducts([
        "product-1",
        "product-2",
      ]);

      expect(result).toBeInstanceOf(Map);
      expect(result.get("product-1")?.salePrice).toBe(79.99);
      expect(result.get("product-2")?.salePrice).toBeNull();
    });

    it("should return empty map for empty product IDs", async () => {
      const result = await service.getEffectivePricesForProducts([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe("create", () => {
    const createDto: CreateSaleDto = {
      productId: "product-1",
      salePrice: 79.99,
      startDate: "2025-01-01T00:00:00.000Z",
      endDate: "2025-12-31T23:59:59.000Z",
      name: "Summer Sale",
      description: "Special discount",
      priority: 0,
      isActive: true,
    };

    it("should create a sale successfully", async () => {
      const product = {
        id: "product-1",
        price: 100.0,
      };
      const sale = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        startDate: new Date(createDto.startDate),
        endDate: new Date(createDto.endDate),
        status: "active",
        isActive: true,
        name: "Summer Sale",
        description: "Special discount",
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: Get product
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([product]),
      );

      // Mock: Insert sale
      (db.insert as jest.Mock).mockReturnValueOnce(
        createInsertChain([sale]),
      );

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.productId).toBe("product-1");
      expect(result.salePrice).toBe(79.99);
    });

    it("should throw NotFoundException if product does not exist", async () => {
      // Mock: Product not found
      (db.select as jest.Mock).mockReturnValueOnce(createSelectChain([]));

      await expect(service.create(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if sale price >= regular price", async () => {
      const product = {
        id: "product-1",
        price: 100.0,
      };

      // Mock: Get product
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([product]),
      );

      const invalidDto = { ...createDto, salePrice: 100.0 };

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw BadRequestException if start date >= end date", async () => {
      const product = {
        id: "product-1",
        price: 100.0,
      };

      // Mock: Get product
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([product]),
      );

      const invalidDto = {
        ...createDto,
        startDate: "2025-12-31T00:00:00.000Z",
        endDate: "2025-01-01T00:00:00.000Z",
      };

      await expect(service.create(invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should create always-active sale when dates are null", async () => {
      const product = {
        id: "product-1",
        price: 100.0,
      };
      const sale = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        startDate: null,
        endDate: null,
        status: "active",
        isActive: true,
        name: null,
        description: null,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: Get product
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([product]),
      );

      // Mock: Insert sale
      (db.insert as jest.Mock).mockReturnValueOnce(
        createInsertChain([sale]),
      );

      const alwaysActiveDto = {
        ...createDto,
        startDate: undefined,
        endDate: undefined,
      };

      const result = await service.create(alwaysActiveDto);

      expect(result).toBeDefined();
      expect(result.status).toBe("active");
    });
  });

  describe("findOne", () => {
    it("should return sale by ID", async () => {
      const sale = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        startDate: new Date(),
        endDate: new Date(),
        status: "active",
        isActive: true,
        name: "Summer Sale",
        description: "Special discount",
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: Get sale
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([sale]),
      );

      const result = await service.findOne("sale-1");

      expect(result).toBeDefined();
      expect(result.id).toBe("sale-1");
    });

    it("should throw NotFoundException if sale does not exist", async () => {
      // Mock: Sale not found
      (db.select as jest.Mock).mockReturnValueOnce(createSelectChain([]));

      await expect(service.findOne("sale-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("should update sale successfully", async () => {
      const existingSale = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        startDate: new Date("2025-01-01"),
        endDate: new Date("2025-12-31"),
        status: "active",
        isActive: true,
        name: "Summer Sale",
        description: "Special discount",
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const product = {
        id: "product-1",
        price: 100.0,
      };
      const updatedSale = {
        ...existingSale,
        salePrice: 69.99,
        updatedAt: new Date(),
      };

      // Mock: Get existing sale
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([existingSale]),
      );

      // Mock: Get product (for validation)
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([product]),
      );

      // Mock: Update sale
      (db.update as jest.Mock).mockReturnValueOnce(
        createUpdateChain([updatedSale]),
      );

      const result = await service.update("sale-1", { salePrice: 69.99 });

      expect(result).toBeDefined();
      expect(result.salePrice).toBe(69.99);
    });

    it("should throw NotFoundException if sale does not exist", async () => {
      // Mock: Sale not found
      (db.select as jest.Mock).mockReturnValueOnce(createSelectChain([]));

      await expect(service.update("sale-1", {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateStatus", () => {
    it("should update sale status successfully", async () => {
      const existingSale = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        startDate: new Date(),
        endDate: new Date(),
        status: "active",
        isActive: true,
        name: "Summer Sale",
        description: "Special discount",
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updatedSale = {
        ...existingSale,
        isActive: false,
        updatedAt: new Date(),
      };

      // Mock: Get existing sale
      (db.select as jest.Mock).mockReturnValueOnce(
        createSelectChain([existingSale]),
      );

      // Mock: Update sale
      (db.update as jest.Mock).mockReturnValueOnce(
        createUpdateChain([updatedSale]),
      );

      const result = await service.updateStatus("sale-1", false);

      expect(result).toBeDefined();
      expect(result.isActive).toBe(false);
    });
  });

  describe("remove", () => {
    it("should delete sale successfully", async () => {
      const sale = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
      };

      // Mock: Get sale
      (db.select as jest.Mock).mockReturnValueOnce(createSelectChain([sale]));

      // Mock: Delete sale
      const deleteChain = {
        where: jest.fn().mockResolvedValue(undefined),
      };
      (db.delete as jest.Mock).mockReturnValueOnce(deleteChain);

      await service.remove("sale-1");

      expect(db.delete).toHaveBeenCalled();
    });

    it("should throw NotFoundException if sale does not exist", async () => {
      // Mock: Sale not found
      (db.select as jest.Mock).mockReturnValueOnce(createSelectChain([]));

      await expect(service.remove("sale-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateSaleStatuses", () => {
    it("should update expired sales", async () => {
      const updateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
      };
      (db.update as jest.Mock).mockReturnValue(updateChain);

      await service.updateSaleStatuses();

      expect(db.update).toHaveBeenCalled();
    });
  });
});

