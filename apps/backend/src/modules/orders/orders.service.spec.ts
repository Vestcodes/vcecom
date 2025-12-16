import {
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  addresses,
  cartItems,
  carts,
  customers,
  db,
  eq,
  inArray,
  orderItems,
  orders,
  payments,
  productVariants,
  products,
  shipments,
  users,
} from "@vcecom/db";
import { CartsService } from "../carts/carts.service";
import { DiscountsService } from "../discounts/discounts.service";
import { InventoryStore } from "../redis/stores/inventory.store";
import { OrdersService } from "./orders.service";

// Mock dependencies
jest.mock("@vcecom/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  eq: jest.fn(),
  and: jest.fn(),
  ilike: jest.fn(),
  desc: jest.fn(),
  inArray: jest.fn(),
  sql: jest.fn(),
  addresses: {},
  cartItems: {},
  carts: {},
  customers: {},
  orderItems: {},
  orders: {},
  payments: {},
  productVariants: {},
  products: {},
  shipments: {},
  users: {},
}));

describe("OrdersService", () => {
  let service: OrdersService;
  let cartsService: CartsService;
  let inventoryStore: InventoryStore;

  const mockUserId = "user-123";
  const mockCustomerId = "customer-123";
  const mockShippingAddressId = "shipping-address-123";
  const mockBillingAddressId = "billing-address-123";
  const mockCartId = "cart-123";
  const mockOrderId = "order-123";
  const mockProductId = "product-123";
  const mockVariantId = "variant-123";

  const mockCustomer = {
    id: mockCustomerId,
    userId: mockUserId,
    email: "test@example.com",
    phone: "1234567890",
    name: "Test Customer",
  };

  const mockShippingAddress = {
    id: mockShippingAddressId,
    customerId: mockCustomerId,
    type: "shipping" as const,
    street: "123 Main St",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    district: "Mumbai",
    country: "India",
    isDefault: true,
  };

  const mockBillingAddress = {
    id: mockBillingAddressId,
    customerId: mockCustomerId,
    type: "billing" as const,
    street: "456 Billing St",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
    district: "Mumbai",
    country: "India",
    isDefault: false,
  };

  const mockCart = {
    id: mockCartId,
    customerId: mockCustomerId,
    sessionId: null,
    subtotal: 1000,
    gstAmount: 180,
    total: 1180,
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: "cart-item-123",
        cartId: mockCartId,
        productVariantId: mockVariantId,
        quantity: 2,
        price: 500,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const mockProduct = {
    id: mockProductId,
    title: "Test Product",
    description: "Test Description",
    price: 500,
    gstRate: 18,
    hsnCode: "123456",
    status: "active" as const,
    categoryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVariant = {
    id: mockVariantId,
    productId: mockProductId,
    sku: "SKU-001",
    price: 500,
    inventory: 10,
    size: null,
    color: null,
    weight: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: CartsService,
          useValue: {
            getCart: jest.fn(),
            clearCart: jest.fn(),
          },
        },
        {
          provide: DiscountsService,
          useValue: {
            validateDiscount: jest.fn(),
            findByCode: jest.fn(),
            recordUsage: jest.fn(),
          },
        },
        {
          provide: InventoryStore,
          useValue: {
            getInventory: jest.fn(),
            setInventory: jest.fn(),
            getReservedQuantity: jest.fn(),
            reserveInventory: jest.fn(),
            releaseReservation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    cartsService = module.get<CartsService>(CartsService);
    discountsService = module.get<DiscountsService>(DiscountsService);
    inventoryStore = module.get<InventoryStore>(InventoryStore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createOrderDto = {
      shippingAddressId: mockShippingAddressId,
      billingAddressId: mockBillingAddressId,
      shippingCost: 50,
    };

    it("should create order successfully from cart", async () => {
      // Mock getCustomerId
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      // Mock validateAddresses
      const mockShippingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockShippingAddress]),
      };

      const mockBillingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBillingAddress]),
      };

      // Mock getCart
      (cartsService.getCart as jest.Mock).mockResolvedValue(mockCart);

      // Mock cartItemsWithVariants query
      const mockCartItemsChain = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            cartItemId: "cart-item-123",
            productVariantId: mockVariantId,
            quantity: 2,
            price: 500,
            variantInventory: 10,
            productGstRate: 18,
          },
        ]),
      };

      // Mock generateOrderNumber
      const mockLimitChainForOrderNumber1 = {
        limit: jest.fn().mockResolvedValue([]),
      };
      const mockOrderByChainForOrderNumber1 = {
        orderBy: jest.fn().mockReturnValue(mockLimitChainForOrderNumber1),
      };
      const mockWhereChainForOrderNumber1 = {
        where: jest.fn().mockReturnValue(mockOrderByChainForOrderNumber1),
      };
      const mockFromChainForOrderNumber1 = {
        from: jest.fn().mockReturnValue(mockWhereChainForOrderNumber1),
      };
      // db.select() should return an object with .from() method
      const mockSelectForOrderNumber1 = mockFromChainForOrderNumber1;

      // Mock InventoryStore for order creation
      (inventoryStore.getInventory as jest.Mock).mockResolvedValue(10);
      (inventoryStore.getReservedQuantity as jest.Mock).mockResolvedValue(0);
      (inventoryStore.reserveInventory as jest.Mock).mockResolvedValue(true);
      (inventoryStore.setInventory as jest.Mock).mockResolvedValue(undefined);
      (inventoryStore.releaseReservation as jest.Mock).mockResolvedValue(undefined);

      // Mock insert order
      const mockInsertOrderChain = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            id: mockOrderId,
            customerId: mockCustomerId,
            orderNumber: "ORD-2025-000001",
            status: "pending",
            subtotal: 1000,
            gstAmount: 180,
            discountCode: null,
            discountAmount: 0,
            shippingCost: 50,
            total: 1230,
            shippingAddressId: mockShippingAddressId,
            billingAddressId: mockBillingAddressId,
            razorpayOrderId: null,
            shippingProvider: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      // Mock insert order items
      const mockInsertOrderItemsChain = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            id: "order-item-123",
            orderId: mockOrderId,
            productVariantId: mockVariantId,
            quantity: 2,
            price: 500,
            gstRate: 18,
            gstAmount: 180,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      // Mock update inventory
      const mockUpdateInventoryChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
      };

      // Mock select for updated variant inventory (after update)
      const mockUpdatedVariantChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ inventory: 8 }]), // 10 - 2 = 8
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockShippingAddressChain)
        .mockReturnValueOnce(mockBillingAddressChain)
        .mockReturnValueOnce(mockCartItemsChain)
        .mockReturnValueOnce(mockSelectForOrderNumber1)
        .mockReturnValueOnce(mockUpdatedVariantChain); // For getting updated inventory after order creation

      (db.insert as jest.Mock)
        .mockReturnValueOnce(mockInsertOrderChain)
        .mockReturnValueOnce(mockInsertOrderItemsChain);

      (db.update as jest.Mock).mockReturnValue(mockUpdateInventoryChain);

      // Mock InventoryStore
      (inventoryStore.getInventory as jest.Mock).mockResolvedValue(10);
      (inventoryStore.getReservedQuantity as jest.Mock).mockResolvedValue(0);
      (inventoryStore.reserveInventory as jest.Mock).mockResolvedValue(true);
      (inventoryStore.setInventory as jest.Mock).mockResolvedValue(undefined);
      (inventoryStore.releaseReservation as jest.Mock).mockResolvedValue(undefined);

      // Mock discount service (no discount code)
      (discountsService.validateDiscount as jest.Mock).mockResolvedValue({
        isValid: false,
      });

      (cartsService.clearCart as jest.Mock).mockResolvedValue(mockCart);

      const result = await service.create(mockUserId, createOrderDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockOrderId);
      expect(result.orderNumber).toBe("ORD-2025-000001");
      expect(result.status).toBe("pending");
      expect(result.total).toBe(1230);
      expect(cartsService.clearCart).toHaveBeenCalledWith(mockUserId, null);
    });

    it("should throw NotFoundException if customer not found", async () => {
      const mockChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockChain);

      await expect(
        service.create(mockUserId, createOrderDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException if shipping address not found", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockShippingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockShippingAddressChain);

      await expect(
        service.create(mockUserId, createOrderDto),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if cart is empty", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockShippingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockShippingAddress]),
      };

      const mockBillingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBillingAddress]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockShippingAddressChain)
        .mockReturnValueOnce(mockBillingAddressChain);

      (cartsService.getCart as jest.Mock).mockResolvedValue({
        ...mockCart,
        items: [],
      });

      await expect(
        service.create(mockUserId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if insufficient inventory", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockShippingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockShippingAddress]),
      };

      const mockBillingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBillingAddress]),
      };

      const mockCartItemsChain = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            cartItemId: "cart-item-123",
            productVariantId: mockVariantId,
            quantity: 20, // More than available
            price: 500,
            variantInventory: 10, // Only 10 available
            productGstRate: 18,
          },
        ]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockShippingAddressChain)
        .mockReturnValueOnce(mockBillingAddressChain)
        .mockReturnValueOnce(mockCartItemsChain);

      (cartsService.getCart as jest.Mock).mockResolvedValue(mockCart);

      await expect(
        service.create(mockUserId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create order with default shipping cost when not provided", async () => {
      const createOrderDtoWithoutShippingCost = {
        shippingAddressId: mockShippingAddressId,
        billingAddressId: mockBillingAddressId,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockShippingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockShippingAddress]),
      };

      const mockBillingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBillingAddress]),
      };

      (cartsService.getCart as jest.Mock).mockResolvedValue(mockCart);

      const mockCartItemsChain = {
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([
          {
            cartItemId: "cart-item-123",
            productVariantId: mockVariantId,
            quantity: 2,
            price: 500,
            variantInventory: 10,
            productGstRate: 18,
          },
        ]),
      };

      // Mock generateOrderNumber for this test
      const mockLimitChainForOrderNumber4 = {
        limit: jest.fn().mockResolvedValue([]),
      };
      const mockOrderByChainForOrderNumber4 = {
        orderBy: jest.fn().mockReturnValue(mockLimitChainForOrderNumber4),
      };
      const mockWhereChainForOrderNumber4 = {
        where: jest.fn().mockReturnValue(mockOrderByChainForOrderNumber4),
      };
      const mockFromChainForOrderNumber4 = {
        from: jest.fn().mockReturnValue(mockWhereChainForOrderNumber4),
      };
      // db.select() should return an object with .from() method
      const mockSelectForOrderNumber4 = mockFromChainForOrderNumber4;

      const mockInsertOrderChain = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            id: mockOrderId,
            customerId: mockCustomerId,
            orderNumber: "ORD-2025-000001",
            status: "pending",
            subtotal: 1000,
            gstAmount: 180,
            shippingCost: 0,
            total: 1180,
            shippingAddressId: mockShippingAddressId,
            billingAddressId: mockBillingAddressId,
            razorpayOrderId: null,
            shippingProvider: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      const mockInsertOrderItemsChain = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          {
            id: "order-item-123",
            orderId: mockOrderId,
            productVariantId: mockVariantId,
            quantity: 2,
            price: 500,
            gstRate: 18,
            gstAmount: 180,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      };

      const mockUpdateVariantChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      // Mock select for updated variant inventory (after update)
      const mockUpdatedVariantChain2 = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ inventory: 8 }]), // 10 - 2 = 8
      };

      // Mock generateOrderNumber for this test
      const mockLimitChainForOrderNumber2 = {
        limit: jest.fn().mockResolvedValue([]),
      };
      const mockOrderByChainForOrderNumber2 = {
        orderBy: jest.fn().mockReturnValue(mockLimitChainForOrderNumber2),
      };
      const mockWhereChainForOrderNumber2 = {
        where: jest.fn().mockReturnValue(mockOrderByChainForOrderNumber2),
      };
      const mockFromChainForOrderNumber2 = {
        from: jest.fn().mockReturnValue(mockWhereChainForOrderNumber2),
      };
      // db.select() should return an object with .from() method
      const mockSelectForOrderNumber2 = mockFromChainForOrderNumber2;

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockShippingAddressChain)
        .mockReturnValueOnce(mockBillingAddressChain)
        .mockReturnValueOnce(mockCartItemsChain)
        .mockReturnValueOnce(mockSelectForOrderNumber2)
        .mockReturnValueOnce(mockUpdatedVariantChain2); // For getting updated inventory after order creation
      (db.insert as jest.Mock)
        .mockReturnValueOnce(mockInsertOrderChain)
        .mockReturnValueOnce(mockInsertOrderItemsChain);
      (db.update as jest.Mock).mockReturnValue(mockUpdateVariantChain);

      // Mock InventoryStore
      (inventoryStore.getInventory as jest.Mock).mockResolvedValue(10);
      (inventoryStore.getReservedQuantity as jest.Mock).mockResolvedValue(0);
      (inventoryStore.reserveInventory as jest.Mock).mockResolvedValue(true);
      (inventoryStore.setInventory as jest.Mock).mockResolvedValue(undefined);
      (inventoryStore.releaseReservation as jest.Mock).mockResolvedValue(undefined);

      (cartsService.clearCart as jest.Mock).mockResolvedValue(undefined);

      const result = await service.create(
        mockUserId,
        createOrderDtoWithoutShippingCost,
      );

      expect(result).toBeDefined();
      expect(result.shippingCost).toBe(0);
      expect(result.total).toBe(1180);
    });
  });

  describe("findOne", () => {
    it("should return order with items", async () => {
      const mockOrder = {
        id: mockOrderId,
        customerId: mockCustomerId,
        orderNumber: "ORD-2025-000001",
        status: "pending" as const,
        subtotal: 1000,
        gstAmount: 180,
        shippingCost: 50,
        total: 1230,
        shippingAddressId: mockShippingAddressId,
        billingAddressId: mockBillingAddressId,
        razorpayOrderId: null,
        shippingProvider: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOrderItems = [
        {
          id: "order-item-123",
          orderId: mockOrderId,
          productVariantId: mockVariantId,
          quantity: 2,
          price: 500,
          gstRate: 18,
          gstAmount: 180,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockOrder]),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockOrderItems),
      };

      // Mock shipping address query (called in findOne)
      const mockShippingAddressChainForFindOne = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockShippingAddress]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderItemsChain)
        .mockReturnValueOnce(mockShippingAddressChainForFindOne); // For shipping address in findOne

      const result = await service.findOne(mockUserId, mockOrderId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockOrderId);
      expect(result.items).toHaveLength(1);
    });

    it("should throw NotFoundException if order not found", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.findOne(mockUserId, mockOrderId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("generateOrderNumber", () => {
    it("should generate order number with sequence when orders exist", async () => {
      const mockLimitChain = {
        limit: jest.fn().mockResolvedValue([
          { orderNumber: "ORD-2025-000005" },
        ]),
      };
      const mockOrderByChain = {
        orderBy: jest.fn().mockReturnValue(mockLimitChain),
      };
      const mockWhereChain = {
        where: jest.fn().mockReturnValue(mockOrderByChain),
      };
      const mockFromChain = {
        from: jest.fn().mockReturnValue(mockWhereChain),
      };
      // db.select() should return an object with .from() method
      const mockSelect = mockFromChain;

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      // Access private method via reflection
      const generateOrderNumber = (service as any).generateOrderNumber.bind(
        service,
      );
      const result = await generateOrderNumber();

      expect(result).toBe("ORD-2025-000006");
    });

    it("should handle invalid order number format gracefully (NaN case)", async () => {
      const mockOrdersChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { orderNumber: "ORD-2025-INVALID" },
        ]),
      };

      (db.select as jest.Mock).mockReturnValue(mockOrdersChain);

      // Access private method via reflection
      const generateOrderNumber = (service as any).generateOrderNumber.bind(
        service,
      );
      const result = await generateOrderNumber();

      // Should default to sequence 1 when parsing fails
      expect(result).toMatch(/^ORD-\d{4}-000001$/);
    });

    it("should handle invalid order number format gracefully", async () => {
      const mockOrdersChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          { orderNumber: "ORD-2025-INVALID" },
        ]),
      };

      (db.select as jest.Mock).mockReturnValue(mockOrdersChain);

      const generateOrderNumber = (service as any).generateOrderNumber.bind(
        service,
      );
      const result = await generateOrderNumber();

      expect(result).toMatch(/^ORD-\d{4}-000001$/);
    });
  });

  describe("validateAddresses", () => {
    it("should throw NotFoundException if billing address not found", async () => {
      const mockShippingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockShippingAddress]),
      };

      const mockBillingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockShippingAddressChain)
        .mockReturnValueOnce(mockBillingAddressChain);

      const validateAddresses = (service as any).validateAddresses.bind(
        service,
      );

      await expect(
        validateAddresses(
          mockCustomerId,
          mockShippingAddressId,
          mockBillingAddressId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    const createOrderDto = {
      shippingAddressId: mockShippingAddressId,
      billingAddressId: mockBillingAddressId,
      shippingCost: 50,
    };

    it("should throw BadRequestException if cart is null", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockShippingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockShippingAddress]),
      };

      const mockBillingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBillingAddress]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain) // getCustomerId
        .mockReturnValueOnce(mockShippingAddressChain) // validateAddresses - shipping
        .mockReturnValueOnce(mockBillingAddressChain); // validateAddresses - billing

      (cartsService.getCart as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(mockUserId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if cart items is null", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockShippingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockShippingAddress]),
      };

      const mockBillingAddressChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockBillingAddress]),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockShippingAddressChain)
        .mockReturnValueOnce(mockBillingAddressChain);

      (cartsService.getCart as jest.Mock).mockResolvedValue({
        ...mockCart,
        items: null,
      });

      await expect(
        service.create(mockUserId, createOrderDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findAll", () => {
    it("should return all orders for customer", async () => {
      const mockOrders = [
        {
          id: mockOrderId,
          customerId: mockCustomerId,
          orderNumber: "ORD-2025-000001",
          status: "pending" as const,
          subtotal: 1000,
          gstAmount: 180,
          shippingCost: 50,
          total: 1230,
          shippingAddressId: mockShippingAddressId,
          billingAddressId: mockBillingAddressId,
          razorpayOrderId: null,
          shippingProvider: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockOrderItems = [
        {
          id: "order-item-123",
          orderId: mockOrderId,
          productVariantId: mockVariantId,
          quantity: 2,
          price: 500,
          gstRate: 18,
          gstAmount: 180,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrder = {
        id: mockOrderId,
        customerId: mockCustomerId,
        orderNumber: "ORD-2025-000001",
        status: "pending" as const,
        subtotal: 1000,
        gstAmount: 180,
        shippingCost: 50,
        total: 1230,
        shippingAddressId: mockShippingAddressId,
        billingAddressId: mockBillingAddressId,
        razorpayOrderId: null,
        shippingProvider: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockOrdersChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockOrderItemsChainForMap = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrdersChain)
        .mockReturnValueOnce(mockOrderItemsChainForMap);

      const result = await service.findAll(mockUserId);

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(1);
    });

    it("should return empty array when customer has no orders", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrdersChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrdersChain);

      const result = await service.findAll(mockUserId);

      expect(result).toBeDefined();
      expect(result).toHaveLength(0);
    });

    it("should handle multiple orders with items", async () => {
      const mockOrders = [
        {
          id: mockOrderId,
          customerId: mockCustomerId,
          orderNumber: "ORD-2025-000001",
          status: "pending" as const,
          subtotal: 1000,
          gstAmount: 180,
          shippingCost: 50,
          total: 1230,
          shippingAddressId: mockShippingAddressId,
          billingAddressId: mockBillingAddressId,
          razorpayOrderId: null,
          shippingProvider: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "order-456",
          customerId: mockCustomerId,
          orderNumber: "ORD-2025-000002",
          status: "confirmed" as const,
          subtotal: 2000,
          gstAmount: 360,
          shippingCost: 100,
          total: 2460,
          shippingAddressId: mockShippingAddressId,
          billingAddressId: mockBillingAddressId,
          razorpayOrderId: null,
          shippingProvider: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockOrderItems1 = [
        {
          id: "order-item-123",
          orderId: mockOrderId,
          productVariantId: mockVariantId,
          quantity: 2,
          price: 500,
          gstRate: 18,
          gstAmount: 180,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockOrderItems2 = [
        {
          id: "order-item-456",
          orderId: "order-456",
          productVariantId: mockVariantId,
          quantity: 4,
          price: 500,
          gstRate: 18,
          gstAmount: 360,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrdersChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      };

      const mockOrderItemsChain1 = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems1),
        }),
      };

      const mockOrderItemsChain2 = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems2),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrdersChain)
        .mockReturnValueOnce(mockOrderItemsChain1)
        .mockReturnValueOnce(mockOrderItemsChain2);

      const result = await service.findAll(mockUserId);

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[0].items).toHaveLength(1);
      expect(result[1].items).toHaveLength(1);
    });

    it("should return all orders when status filter is not provided", async () => {
      const mockOrders = [
        {
          id: "order-123",
          customerId: mockCustomerId,
          orderNumber: "ORD-2025-001234",
          status: "pending" as const,
          subtotal: 1000,
          gstAmount: 180,
          shippingCost: 50,
          total: 1230,
          shippingAddressId: mockShippingAddressId,
          billingAddressId: mockBillingAddressId,
          razorpayOrderId: null,
          shippingProvider: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockOrderItems = [
        {
          id: "order-item-123",
          orderId: "order-123",
          productVariantId: mockVariantId,
          quantity: 2,
          price: 500,
          gstRate: 18,
          gstAmount: 180,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrdersChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrdersChain)
        .mockReturnValueOnce(mockOrderItemsChain);

      const result = await service.findAll(mockUserId);

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
    });

    it("should filter orders by status", async () => {
      const mockOrders = [
        {
          id: "order-123",
          customerId: mockCustomerId,
          orderNumber: "ORD-2025-001234",
          status: "pending" as const,
          subtotal: 1000,
          gstAmount: 180,
          shippingCost: 50,
          total: 1230,
          shippingAddressId: mockShippingAddressId,
          billingAddressId: mockBillingAddressId,
          razorpayOrderId: null,
          shippingProvider: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockOrderItems = [
        {
          id: "order-item-123",
          orderId: "order-123",
          productVariantId: mockVariantId,
          quantity: 2,
          price: 500,
          gstRate: 18,
          gstAmount: 180,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrdersChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue(mockOrders),
          }),
        }),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrdersChain)
        .mockReturnValueOnce(mockOrderItemsChain);

      const result = await service.findAll(mockUserId, "pending");

      expect(result).toBeDefined();
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("pending");
    });
  });

  describe("updateStatus", () => {
    const mockOrder = {
      id: mockOrderId,
      customerId: mockCustomerId,
      orderNumber: "ORD-2025-001234",
      status: "pending" as const,
      subtotal: 1000,
      gstAmount: 180,
      shippingCost: 50,
      total: 1230,
      shippingAddressId: mockShippingAddressId,
      billingAddressId: mockBillingAddressId,
      razorpayOrderId: null,
      shippingProvider: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdatedOrder = {
      ...mockOrder,
      status: "confirmed" as const,
      updatedAt: new Date(),
    };

    const mockOrderItems = [
      {
        id: "order-item-123",
        orderId: mockOrderId,
        productVariantId: mockVariantId,
        quantity: 2,
        price: 500,
        gstRate: 18,
        gstAmount: 180,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it("should update order status successfully", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedOrder]),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderItemsChain);
      (db.update as jest.Mock).mockReturnValue(mockUpdateChain);

      const result = await service.updateStatus(mockUserId, mockOrderId, {
        status: "confirmed",
      });

      expect(result).toBeDefined();
      expect(result.status).toBe("confirmed");
      expect(result.items).toHaveLength(1);
      expect(db.update).toHaveBeenCalled();
    });

    it("should throw NotFoundException if order not found", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.updateStatus(mockUserId, "non-existent-order", {
          status: "confirmed",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException for invalid status transition from pending", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.updateStatus(mockUserId, mockOrderId, {
          status: "delivered",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException for invalid status transition from confirmed", async () => {
      const confirmedOrder = { ...mockOrder, status: "confirmed" as const };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([confirmedOrder]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.updateStatus(mockUserId, mockOrderId, {
          status: "delivered",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when trying to transition from cancelled", async () => {
      const cancelledOrder = { ...mockOrder, status: "cancelled" as const };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([cancelledOrder]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.updateStatus(mockUserId, mockOrderId, {
          status: "confirmed",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should allow valid transition from pending to confirmed", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedOrder]),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderItemsChain);
      (db.update as jest.Mock).mockReturnValue(mockUpdateChain);

      const result = await service.updateStatus(mockUserId, mockOrderId, {
        status: "confirmed",
      });

      expect(result.status).toBe("confirmed");
    });

    it("should allow valid transition from confirmed to processing", async () => {
      const confirmedOrder = { ...mockOrder, status: "confirmed" as const };
      const processingOrder = {
        ...confirmedOrder,
        status: "processing" as const,
        updatedAt: new Date(),
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([confirmedOrder]),
          }),
        }),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([processingOrder]),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderItemsChain);
      (db.update as jest.Mock).mockReturnValue(mockUpdateChain);

      const result = await service.updateStatus(mockUserId, mockOrderId, {
        status: "processing",
      });

      expect(result.status).toBe("processing");
    });

    it("should allow valid transition from processing to shipped", async () => {
      const processingOrder = { ...mockOrder, status: "processing" as const };
      const shippedOrder = {
        ...processingOrder,
        status: "shipped" as const,
        updatedAt: new Date(),
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([processingOrder]),
          }),
        }),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([shippedOrder]),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderItemsChain);
      (db.update as jest.Mock).mockReturnValue(mockUpdateChain);

      const result = await service.updateStatus(mockUserId, mockOrderId, {
        status: "shipped",
      });

      expect(result.status).toBe("shipped");
    });

    it("should allow valid transition from shipped to delivered", async () => {
      const shippedOrder = { ...mockOrder, status: "shipped" as const };
      const deliveredOrder = {
        ...shippedOrder,
        status: "delivered" as const,
        updatedAt: new Date(),
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([shippedOrder]),
          }),
        }),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([deliveredOrder]),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderItemsChain);
      (db.update as jest.Mock).mockReturnValue(mockUpdateChain);

      const result = await service.updateStatus(mockUserId, mockOrderId, {
        status: "delivered",
      });

      expect(result.status).toBe("delivered");
    });

    it("should allow valid transition from delivered to refunded", async () => {
      const deliveredOrder = { ...mockOrder, status: "delivered" as const };
      const refundedOrder = {
        ...deliveredOrder,
        status: "refunded" as const,
        updatedAt: new Date(),
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([deliveredOrder]),
          }),
        }),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([refundedOrder]),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderItemsChain);
      (db.update as jest.Mock).mockReturnValue(mockUpdateChain);

      const result = await service.updateStatus(mockUserId, mockOrderId, {
        status: "refunded",
      });

      expect(result.status).toBe("refunded");
    });

    it("should allow valid transition from pending to cancelled", async () => {
      const cancelledOrder = {
        ...mockOrder,
        status: "cancelled" as const,
        updatedAt: new Date(),
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockUpdateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([cancelledOrder]),
      };

      const mockOrderItemsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOrderItems),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockOrderItemsChain);
      (db.update as jest.Mock).mockReturnValue(mockUpdateChain);

      const result = await service.updateStatus(mockUserId, mockOrderId, {
        status: "cancelled",
      });

      expect(result.status).toBe("cancelled");
    });

    it("should throw BadRequestException for unknown status", async () => {
      const unknownStatusOrder = {
        ...mockOrder,
        status: "unknown_status" as any,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([unknownStatusOrder]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.updateStatus(mockUserId, mockOrderId, {
          status: "confirmed",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when trying to transition from refunded", async () => {
      const refundedOrder = { ...mockOrder, status: "refunded" as const };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([refundedOrder]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.updateStatus(mockUserId, mockOrderId, {
          status: "confirmed",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should show 'none' when no valid transitions exist", async () => {
      const cancelledOrder = { ...mockOrder, status: "cancelled" as const };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([cancelledOrder]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      try {
        await service.updateStatus(mockUserId, mockOrderId, {
          status: "confirmed",
        });
        fail("Should have thrown BadRequestException");
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain("none");
      }
    });
  });

  describe("getTracking", () => {
    const mockOrder = {
      id: mockOrderId,
      customerId: mockCustomerId,
      orderNumber: "ORD-2025-001234",
      status: "shipped" as const,
      subtotal: 1000,
      gstAmount: 180,
      shippingCost: 50,
      total: 1230,
      shippingAddressId: mockShippingAddressId,
      billingAddressId: mockBillingAddressId,
      razorpayOrderId: null,
      shippingProvider: "shiprocket",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockShipment = {
      id: "shipment-123",
      orderId: mockOrderId,
      provider: "shiprocket",
      trackingNumber: "TRACK123456789",
      status: "in_transit" as const,
      labelUrl: "https://example.com/label.pdf",
      awbNumber: "AWB123456789",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should return order tracking information with shipments", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTracking(mockUserId, mockOrderId);

      expect(result).toBeDefined();
      expect(result.orderId).toBe(mockOrderId);
      expect(result.orderNumber).toBe("ORD-2025-001234");
      expect(result.status).toBe("shipped");
      expect(result.shippingProvider).toBe("shiprocket");
      expect(result.shipments).toHaveLength(1);
      expect(result.shipments[0].trackingNumber).toBe("TRACK123456789");
      expect(result.shipments[0].status).toBe("in_transit");
    });

    it("should return empty shipments array when no shipments exist", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTracking(mockUserId, mockOrderId);

      expect(result).toBeDefined();
      expect(result.shipments).toHaveLength(0);
    });

    it("should throw NotFoundException if order not found", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.getTracking(mockUserId, "non-existent-order"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getTimeline", () => {
    const mockOrder = {
      id: mockOrderId,
      customerId: mockCustomerId,
      orderNumber: "ORD-2025-001234",
      status: "shipped" as const,
      subtotal: 1000,
      gstAmount: 180,
      shippingCost: 50,
      total: 1230,
      shippingAddressId: mockShippingAddressId,
      billingAddressId: mockBillingAddressId,
      razorpayOrderId: null,
      shippingProvider: "shiprocket",
      createdAt: new Date("2025-11-26T10:00:00Z"),
      updatedAt: new Date("2025-11-26T12:00:00Z"),
    };

    const mockPayment = {
      id: "payment-123",
      orderId: mockOrderId,
      razorpayPaymentId: "pay_123456",
      razorpayOrderId: "order_123456",
      amount: 1230,
      status: "captured" as const,
      method: "razorpay" as const,
      createdAt: new Date("2025-11-26T10:30:00Z"),
      updatedAt: new Date("2025-11-26T10:31:00Z"),
    };

    const mockShipment = {
      id: "shipment-123",
      orderId: mockOrderId,
      provider: "shiprocket",
      trackingNumber: "TRACK123456789",
      status: "in_transit" as const,
      labelUrl: "https://example.com/label.pdf",
      awbNumber: "AWB123456789",
      createdAt: new Date("2025-11-26T11:00:00Z"),
      updatedAt: new Date("2025-11-26T12:00:00Z"),
    };

    it("should return order timeline with all events", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockPayment]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      expect(result).toBeDefined();
      expect(result.orderId).toBe(mockOrderId);
      expect(result.orderNumber).toBe("ORD-2025-001234");
      expect(result.currentStatus).toBe("shipped");
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.events[0].type).toBeDefined();
      expect(result.events[0].title).toBeDefined();
      expect(result.events[0].timestamp).toBeDefined();
    });

    it("should include order created event", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const orderCreatedEvent = result.events.find(
        (e) => e.type === "order_created",
      );
      expect(orderCreatedEvent).toBeDefined();
      expect(orderCreatedEvent?.title).toBe("Order Created");
    });

    it("should include payment events when payments exist", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockPayment]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const paymentInitiatedEvent = result.events.find(
        (e) => e.type === "payment_initiated",
      );
      expect(paymentInitiatedEvent).toBeDefined();

      const paymentCompletedEvent = result.events.find(
        (e) => e.type === "payment_completed",
      );
      expect(paymentCompletedEvent).toBeDefined();
    });

    it("should include shipment events when shipments exist", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const shipmentCreatedEvent = result.events.find(
        (e) => e.type === "shipment_created",
      );
      expect(shipmentCreatedEvent).toBeDefined();

      const shipmentInTransitEvent = result.events.find(
        (e) => e.type === "shipment_in_transit",
      );
      expect(shipmentInTransitEvent).toBeDefined();
    });

    it("should handle failed payment status", async () => {
      const failedPayment = {
        ...mockPayment,
        status: "failed" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([failedPayment]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const paymentFailedEvent = result.events.find(
        (e) => e.type === "payment_failed",
      );
      expect(paymentFailedEvent).toBeDefined();
    });

    it("should handle label_generated shipment status", async () => {
      const labelGeneratedShipment = {
        ...mockShipment,
        status: "label_generated" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([labelGeneratedShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const labelGeneratedEvent = result.events.find(
        (e) => e.type === "shipment_label_generated",
      );
      expect(labelGeneratedEvent).toBeDefined();
    });

    it("should handle picked_up shipment status", async () => {
      const pickedUpShipment = {
        ...mockShipment,
        status: "picked_up" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([pickedUpShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const pickedUpEvent = result.events.find(
        (e) => e.type === "shipment_picked_up",
      );
      expect(pickedUpEvent).toBeDefined();
    });

    it("should handle out_for_delivery shipment status", async () => {
      const outForDeliveryShipment = {
        ...mockShipment,
        status: "out_for_delivery" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([outForDeliveryShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const outForDeliveryEvent = result.events.find(
        (e) => e.type === "shipment_out_for_delivery",
      );
      expect(outForDeliveryEvent).toBeDefined();
    });

    it("should handle different shipment statuses", async () => {
      const deliveredShipment = {
        ...mockShipment,
        status: "delivered" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([deliveredShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const shipmentDeliveredEvent = result.events.find(
        (e) => e.type === "shipment_delivered",
      );
      expect(shipmentDeliveredEvent).toBeDefined();
    });

    it("should handle failed shipment status", async () => {
      const failedShipment = {
        ...mockShipment,
        status: "failed" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([failedShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const failedEvent = result.events.find(
        (e) => e.type === "shipment_failed",
      );
      expect(failedEvent).toBeDefined();
    });

    it("should handle returned shipment status", async () => {
      const returnedShipment = {
        ...mockShipment,
        status: "returned" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([returnedShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const returnedEvent = result.events.find(
        (e) => e.type === "shipment_returned",
      );
      expect(returnedEvent).toBeDefined();
    });

    it("should handle shipments without tracking numbers (label_generated)", async () => {
      const shipmentWithoutTracking = {
        ...mockShipment,
        trackingNumber: null,
        status: "label_generated" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([shipmentWithoutTracking]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const labelGeneratedEvent = result.events.find(
        (e) => e.type === "shipment_label_generated",
      );
      expect(labelGeneratedEvent).toBeDefined();
      expect(labelGeneratedEvent?.description).not.toContain("tracking number");
    });

    it("should handle shipments without tracking numbers (picked_up)", async () => {
      const shipmentWithoutTracking = {
        ...mockShipment,
        trackingNumber: null,
        status: "picked_up" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([shipmentWithoutTracking]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const pickedUpEvent = result.events.find(
        (e) => e.type === "shipment_picked_up",
      );
      expect(pickedUpEvent).toBeDefined();
      expect(pickedUpEvent?.description).not.toContain("Tracking:");
    });

    it("should handle shipments without tracking numbers (in_transit)", async () => {
      const shipmentWithoutTracking = {
        ...mockShipment,
        trackingNumber: null,
        status: "in_transit" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([shipmentWithoutTracking]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const inTransitEvent = result.events.find(
        (e) => e.type === "shipment_in_transit",
      );
      expect(inTransitEvent).toBeDefined();
      expect(inTransitEvent?.description).not.toContain("Tracking:");
    });

    it("should handle shipments without tracking numbers (out_for_delivery)", async () => {
      const shipmentWithoutTracking = {
        ...mockShipment,
        trackingNumber: null,
        status: "out_for_delivery" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([shipmentWithoutTracking]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const outForDeliveryEvent = result.events.find(
        (e) => e.type === "shipment_out_for_delivery",
      );
      expect(outForDeliveryEvent).toBeDefined();
      expect(outForDeliveryEvent?.description).not.toContain("Tracking:");
    });

    it("should handle shipments without tracking numbers (delivered)", async () => {
      const shipmentWithoutTracking = {
        ...mockShipment,
        trackingNumber: null,
        status: "delivered" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([shipmentWithoutTracking]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const deliveredEvent = result.events.find(
        (e) => e.type === "shipment_delivered",
      );
      expect(deliveredEvent).toBeDefined();
      expect(deliveredEvent?.description).not.toContain("Tracking:");
    });

    it("should handle shipments without tracking numbers (failed)", async () => {
      const shipmentWithoutTracking = {
        ...mockShipment,
        trackingNumber: null,
        status: "failed" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([shipmentWithoutTracking]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const failedEvent = result.events.find(
        (e) => e.type === "shipment_failed",
      );
      expect(failedEvent).toBeDefined();
      expect(failedEvent?.description).not.toContain("Tracking:");
    });

    it("should handle shipments without tracking numbers (returned)", async () => {
      const shipmentWithoutTracking = {
        ...mockShipment,
        trackingNumber: null,
        status: "returned" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([shipmentWithoutTracking]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const returnedEvent = result.events.find(
        (e) => e.type === "shipment_returned",
      );
      expect(returnedEvent).toBeDefined();
      expect(returnedEvent?.description).not.toContain("Tracking:");
    });

    it("should handle payment status processing", async () => {
      const processingPayment = {
        ...mockPayment,
        status: "processing" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([processingPayment]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const paymentInitiatedEvent = result.events.find(
        (e) => e.type === "payment_initiated",
      );
      expect(paymentInitiatedEvent).toBeDefined();

      // Should not have payment_completed or payment_failed events
      const paymentCompletedEvent = result.events.find(
        (e) => e.type === "payment_completed",
      );
      const paymentFailedEvent = result.events.find(
        (e) => e.type === "payment_failed",
      );
      expect(paymentCompletedEvent).toBeUndefined();
      expect(paymentFailedEvent).toBeUndefined();
    });

    it("should sort events by timestamp (newest first)", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockPayment]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([mockShipment]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      // Check that events are sorted (newest first)
      for (let i = 0; i < result.events.length - 1; i++) {
        expect(
          result.events[i].timestamp.getTime(),
        ).toBeGreaterThanOrEqual(result.events[i + 1].timestamp.getTime());
      }
    });

    it("should throw NotFoundException if order not found", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain);

      await expect(
        service.getTimeline(mockUserId, "non-existent-order"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should include status changed event when status is not pending", async () => {
      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const statusChangedEvent = result.events.find(
        (e) => e.type === "status_changed",
      );
      expect(statusChangedEvent).toBeDefined();
      expect(statusChangedEvent?.newValue).toBe("shipped");
    });

    it("should not include status changed event when status is pending", async () => {
      const pendingOrder = {
        ...mockOrder,
        status: "pending" as const,
      };

      const mockCustomerChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockCustomer]),
      };

      const mockOrderChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([pendingOrder]),
          }),
        }),
      };

      const mockPaymentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      const mockShipmentsChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            orderBy: jest.fn().mockResolvedValue([]),
          }),
        }),
      };

      (db.select as jest.Mock)
        .mockReturnValueOnce(mockCustomerChain)
        .mockReturnValueOnce(mockOrderChain)
        .mockReturnValueOnce(mockPaymentsChain)
        .mockReturnValueOnce(mockShipmentsChain);

      const result = await service.getTimeline(mockUserId, mockOrderId);

      const statusChangedEvent = result.events.find(
        (e) => e.type === "status_changed",
      );
      expect(statusChangedEvent).toBeUndefined();
    });
  });
});
