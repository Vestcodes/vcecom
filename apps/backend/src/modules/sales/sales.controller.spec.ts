import { Test, TestingModule } from "@nestjs/testing";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";

// Mock database to avoid DATABASE_URL requirement
jest.mock("@vcecom/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  productSales: {},
  products: {},
  eq: jest.fn(),
  and: jest.fn(),
  or: jest.fn(),
  inArray: jest.fn(),
  desc: jest.fn(),
  gte: jest.fn(),
  lte: jest.fn(),
  sql: jest.fn(),
}));

describe("SalesController", () => {
  let controller: SalesController;
  let service: SalesService;

  const mockSalesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    getEffectivePrice: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        {
          provide: SalesService,
          useValue: mockSalesService,
        },
      ],
    }).compile();

    controller = module.get<SalesController>(SalesController);
    service = module.get<SalesService>(SalesService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should create a sale", async () => {
      const createDto: CreateSaleDto = {
        productId: "product-1",
        salePrice: 79.99,
        startDate: "2025-01-01T00:00:00.000Z",
        endDate: "2025-12-31T23:59:59.000Z",
        name: "Summer Sale",
        priority: 0,
        isActive: true,
      };

      const mockResponse = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        startDate: new Date(createDto.startDate),
        endDate: new Date(createDto.endDate),
        status: "active" as const,
        isActive: true,
        name: "Summer Sale",
        description: null,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSalesService.create.mockResolvedValue(mockResponse);

      const result = await controller.create(createDto);

      expect(result).toEqual(mockResponse);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe("findAll", () => {
    it("should return list of sales", async () => {
      const mockResponse = [
        {
          id: "sale-1",
          productId: "product-1",
          salePrice: 79.99,
          status: "active" as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSalesService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll();

      expect(result).toEqual(mockResponse);
      expect(service.findAll).toHaveBeenCalledWith(undefined, undefined);
    });

    it("should filter by productId", async () => {
      const mockResponse = [
        {
          id: "sale-1",
          productId: "product-1",
          salePrice: 79.99,
          status: "active" as const,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSalesService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll("product-1");

      expect(service.findAll).toHaveBeenCalledWith("product-1", undefined);
    });

    it("should filter by status", async () => {
      const mockResponse: unknown[] = [];

      mockSalesService.findAll.mockResolvedValue(mockResponse);

      await controller.findAll(undefined, "active");

      expect(service.findAll).toHaveBeenCalledWith(undefined, "active");
    });
  });

  describe("getProductSale", () => {
    it("should return effective price for product", async () => {
      const mockResponse = {
        price: 100.0,
        salePrice: 79.99,
        isOnSale: true,
        saleId: "sale-1",
      };

      mockSalesService.getEffectivePrice.mockResolvedValue(mockResponse);

      const result = await controller.getProductSale("product-1");

      expect(result).toEqual(mockResponse);
      expect(service.getEffectivePrice).toHaveBeenCalledWith("product-1");
    });
  });

  describe("findOne", () => {
    it("should return a sale by id", async () => {
      const mockSale = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        status: "active" as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSalesService.findOne.mockResolvedValue(mockSale);

      const result = await controller.findOne("sale-1");

      expect(result).toEqual(mockSale);
      expect(service.findOne).toHaveBeenCalledWith("sale-1");
    });
  });

  describe("update", () => {
    it("should update a sale", async () => {
      const updateDto = { salePrice: 69.99 };
      const mockResponse = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 69.99,
        status: "active" as const,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSalesService.update.mockResolvedValue(mockResponse);

      const result = await controller.update("sale-1", updateDto);

      expect(result).toEqual(mockResponse);
      expect(service.update).toHaveBeenCalledWith("sale-1", updateDto);
    });
  });

  describe("updateStatus", () => {
    it("should update sale status", async () => {
      const mockResponse = {
        id: "sale-1",
        productId: "product-1",
        salePrice: 79.99,
        status: "active" as const,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSalesService.updateStatus.mockResolvedValue(mockResponse);

      const result = await controller.updateStatus("sale-1", {
        isActive: false,
      });

      expect(result).toEqual(mockResponse);
      expect(service.updateStatus).toHaveBeenCalledWith("sale-1", false);
    });
  });

  describe("remove", () => {
    it("should delete a sale", async () => {
      mockSalesService.remove.mockResolvedValue(undefined);

      const result = await controller.remove("sale-1");

      expect(result).toEqual({ message: "Sale deleted successfully" });
      expect(service.remove).toHaveBeenCalledWith("sale-1");
    });
  });
});

