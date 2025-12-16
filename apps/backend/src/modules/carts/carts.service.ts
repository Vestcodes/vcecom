import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  addresses,
  and,
  cartItems,
  carts,
  customers,
  db,
  eq,
  inArray,
  products,
  productVariants,
} from "@vcecom/db";
import { calculateDiscount } from "../../common/utils/discount.utils";
import { calculateGstBreakdown } from "../../common/utils/gst.utils";
import { DiscountsService } from "../discounts/discounts.service";
import { SalesService } from "../sales/sales.service";

@Injectable()
export class CartsService {
  constructor(
    private readonly discountsService: DiscountsService,
    private readonly salesService: SalesService,
  ) {}
  private readonly CART_EXPIRY_DAYS = 30; // Cart expires after 30 days

  /**
   * Get or create cart for customer or session
   */
  private async getOrCreateCart(
    customerId: string | null,
    sessionId: string | null,
  ) {
    if (customerId) {
      // Customer cart
      let [cart] = await db
        .select()
        .from(carts)
        .where(eq(carts.customerId, customerId))
        .limit(1);

      if (!cart) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.CART_EXPIRY_DAYS);

        [cart] = await db
          .insert(carts)
          .values({
            customerId,
            expiresAt,
          })
          .returning();
      }

      return cart;
    } else if (sessionId) {
      // Guest cart
      let [cart] = await db
        .select()
        .from(carts)
        .where(eq(carts.sessionId, sessionId))
        .limit(1);

      if (!cart) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.CART_EXPIRY_DAYS);

        [cart] = await db
          .insert(carts)
          .values({
            sessionId,
            expiresAt,
          })
          .returning();
      }

      return cart;
    } else {
      throw new BadRequestException(
        "Either customerId or sessionId must be provided",
      );
    }
  }

  /**
   * Get customer ID from user ID
   */
  private async getCustomerId(userId: string): Promise<string | null> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    return customer?.id || null;
  }

  /**
   * Get seller state (default to Maharashtra for now)
   * TODO: This should come from business configuration
   */
  private getSellerState(): string {
    return process.env.SELLER_STATE || "Maharashtra";
  }

  /**
   * Get buyer state from customer's default address
   */
  private async getBuyerState(
    customerId: string | null,
  ): Promise<string | null> {
    if (!customerId) {
      return null;
    }

    // Get default shipping address
    const [defaultAddress] = await db
      .select({ state: addresses.state })
      .from(addresses)
      .where(
        and(
          eq(addresses.customerId, customerId),
          eq(addresses.isDefault, true),
        ),
      )
      .limit(1);

    return defaultAddress?.state || null;
  }

  /**
   * Recalculate cart totals with proper CGST/SGST/IGST calculation and discounts
   */
  private async recalculateCartTotals(
    cartId: string,
    customerId: string | null = null,
  ) {
    // Get all cart items with product prices
    const items = await db
      .select({
        id: cartItems.id,
        quantity: cartItems.quantity,
        price: cartItems.price,
        productVariantId: cartItems.productVariantId,
        productId: productVariants.productId,
      })
      .from(cartItems)
      .innerJoin(
        productVariants,
        eq(cartItems.productVariantId, productVariants.id),
      )
      .where(eq(cartItems.cartId, cartId));

    // Get sale prices for all products in cart
    const productIds = [...new Set(items.map((item) => item.productId))];
    const salePrices =
      await this.salesService.getEffectivePricesForProducts(productIds);

    // Calculate subtotal using sale prices where applicable
    const subtotal = items.reduce((sum, item) => {
      const sale = salePrices.get(item.productId);
      const effectivePrice = sale?.salePrice || item.price;
      return sum + effectivePrice * item.quantity;
    }, 0);

    // Get GST rates from products (reuse productIds)
    let productGstRates: Array<{ id: string; gstRate: number }> = [];

    if (productIds.length > 0) {
      productGstRates = await db
        .select({
          id: products.id,
          gstRate: products.gstRate,
        })
        .from(products)
        .where(inArray(products.id, productIds));
    }

    const gstRateMap = new Map(productGstRates.map((p) => [p.id, p.gstRate]));

    // Get buyer state
    const buyerState = await this.getBuyerState(customerId);
    const sellerState = this.getSellerState();

    // Calculate GST breakdown per item
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    for (const item of items) {
      const gstRate = gstRateMap.get(item.productId) || 0;
      // Use sale price if available, otherwise use regular price
      const sale = salePrices.get(item.productId);
      const effectivePrice = sale?.salePrice || item.price;
      const itemAmount = effectivePrice * item.quantity;

      if (gstRate > 0 && buyerState) {
        const breakdown = calculateGstBreakdown(
          itemAmount,
          gstRate,
          sellerState,
          buyerState,
        );
        totalCgst += breakdown.cgst;
        totalSgst += breakdown.sgst;
        totalIgst += breakdown.igst;
      } else if (gstRate > 0) {
        // No buyer state - use IGST (inter-state)
        const breakdown = calculateGstBreakdown(
          itemAmount,
          gstRate,
          sellerState,
          "", // Empty buyer state triggers inter-state
        );
        totalIgst += breakdown.igst;
      }
    }

    const totalGstAmount = totalCgst + totalSgst + totalIgst;

    // Get cart to check for discount code
    const [cart] = await db
      .select({ discountCode: carts.discountCode })
      .from(carts)
      .where(eq(carts.id, cartId))
      .limit(1);

    // Calculate discount if discount code exists
    let discountAmount = 0;
    if (cart?.discountCode) {
      try {
        // Get product details for discount eligibility
        const productDetails = await db
          .select({
            productId: products.id,
            categoryId: products.categoryId,
          })
          .from(products)
          .where(inArray(products.id, productIds));

        const productMap = new Map(productDetails.map((p) => [p.productId, p]));

        // Build cart items with product info for discount calculation
        // Use sale prices for discount calculation (discounts apply after sale prices)
        const cartItemsForDiscount = items.map((item) => {
          const product = productMap.get(item.productId);
          const sale = salePrices.get(item.productId);
          const effectivePrice = sale?.salePrice || item.price;
          return {
            productId: item.productId,
            categoryId: product?.categoryId || null,
            collectionIds: [], // TODO: Add when product-collections junction table exists
            tagIds: [], // TODO: Add when product-tags junction table exists
            price: effectivePrice,
            quantity: item.quantity,
          };
        });

        // Validate and get discount
        const userId = customerId
          ? await this.getUserIdFromCustomerId(customerId)
          : undefined;
        const validation = await this.discountsService.validateDiscount(
          cart.discountCode,
          userId,
          subtotal,
        );

        if (validation.isValid && validation.discount) {
          // Calculate discount
          const discountResult = calculateDiscount(
            validation.discount,
            cartItemsForDiscount,
          );
          discountAmount = discountResult.discountAmount;
        } else {
          // Invalid discount, remove it
          await db
            .update(carts)
            .set({ discountCode: null })
            .where(eq(carts.id, cartId));
        }
      } catch (_error) {
        // Discount validation failed, remove discount code
        await db
          .update(carts)
          .set({ discountCode: null })
          .where(eq(carts.id, cartId));
      }
    }

    // Calculate total after discount (discount applies to subtotal before GST)
    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const total = subtotalAfterDiscount + totalGstAmount;

    // Update cart totals
    await db
      .update(carts)
      .set({
        subtotal,
        gstAmount: totalGstAmount,
        discountAmount,
        total,
      })
      .where(eq(carts.id, cartId));

    return {
      subtotal,
      gstAmount: totalGstAmount,
      discountAmount,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      total,
    };
  }

  /**
   * Get user ID from customer ID
   */
  private async getUserIdFromCustomerId(
    customerId: string,
  ): Promise<string | undefined> {
    const [customer] = await db
      .select({ userId: customers.userId })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    return customer?.userId || undefined;
  }

  /**
   * Get cart (for customer or session)
   */
  async getCart(userId: string | null, sessionId: string | null) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Get cart items with product information
    const items = await db
      .select({
        id: cartItems.id,
        productVariantId: cartItems.productVariantId,
        quantity: cartItems.quantity,
        price: cartItems.price,
        createdAt: cartItems.createdAt,
        updatedAt: cartItems.updatedAt,
        productId: productVariants.productId,
      })
      .from(cartItems)
      .innerJoin(
        productVariants,
        eq(cartItems.productVariantId, productVariants.id),
      )
      .where(eq(cartItems.cartId, cart.id));

    // Get sale prices for products in cart
    const productIds = [...new Set(items.map((item) => item.productId))];
    const salePrices =
      await this.salesService.getEffectivePricesForProducts(productIds);

    // Recalculate totals and get GST breakdown
    const gstBreakdown = await this.recalculateCartTotals(cart.id, customerId);

    // Get updated cart
    const [updatedCart] = await db
      .select()
      .from(carts)
      .where(eq(carts.id, cart.id))
      .limit(1);

    // Enrich items with sale price information
    const enrichedItems = items.map((item) => {
      const sale = salePrices.get(item.productId);
      // Get regular price from product variant
      return {
        id: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        price: item.price, // Price when added to cart
        regularPrice: item.price, // For now, same as price (could fetch from product if needed)
        salePrice: sale?.salePrice || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return {
      ...updatedCart,
      discountCode: updatedCart.discountCode,
      discountAmount: Number(updatedCart.discountAmount || 0),
      gstBreakdown: {
        cgst: gstBreakdown.cgst,
        sgst: gstBreakdown.sgst,
        igst: gstBreakdown.igst,
        totalGst: gstBreakdown.gstAmount,
        isIntraState: gstBreakdown.cgst > 0 || gstBreakdown.sgst > 0,
      },
      items: enrichedItems,
    };
  }

  /**
   * Add item to cart
   */
  async addItem(
    userId: string | null,
    sessionId: string | null,
    addItemDto: { productVariantId: string; quantity: number },
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Check if product variant exists and get its price
    const [variant] = await db
      .select({
        id: productVariants.id,
        price: productVariants.price,
        inventory: productVariants.inventory,
        productId: productVariants.productId,
      })
      .from(productVariants)
      .where(eq(productVariants.id, addItemDto.productVariantId))
      .limit(1);

    if (!variant) {
      throw new NotFoundException("Product variant not found");
    }

    // Check inventory
    if (variant.inventory < addItemDto.quantity) {
      throw new BadRequestException(
        `Insufficient inventory. Available: ${variant.inventory}`,
      );
    }

    // Check if item already exists in cart
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cart.id),
          eq(cartItems.productVariantId, addItemDto.productVariantId),
        ),
      )
      .limit(1);

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + addItemDto.quantity;

      // Check inventory again
      if (variant.inventory < newQuantity) {
        throw new BadRequestException(
          `Insufficient inventory. Available: ${variant.inventory}`,
        );
      }

      await db
        .update(cartItems)
        .set({ quantity: newQuantity })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      // Create new cart item
      await db.insert(cartItems).values({
        cartId: cart.id,
        productVariantId: addItemDto.productVariantId,
        quantity: addItemDto.quantity,
        price: variant.price,
      });
    }

    // Recalculate totals
    await this.recalculateCartTotals(cart.id);

    return this.getCart(userId, sessionId);
  }

  /**
   * Update cart item quantity
   */
  async updateItem(
    userId: string | null,
    sessionId: string | null,
    itemId: string,
    updateDto: { quantity: number },
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Check if item exists and belongs to cart
    const [item] = await db
      .select({
        id: cartItems.id,
        productVariantId: cartItems.productVariantId,
      })
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);

    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    // Check inventory
    const [variant] = await db
      .select({
        inventory: productVariants.inventory,
      })
      .from(productVariants)
      .where(eq(productVariants.id, item.productVariantId))
      .limit(1);

    if (variant.inventory < updateDto.quantity) {
      throw new BadRequestException(
        `Insufficient inventory. Available: ${variant.inventory}`,
      );
    }

    // Update quantity
    await db
      .update(cartItems)
      .set({ quantity: updateDto.quantity })
      .where(eq(cartItems.id, itemId));

    // Recalculate totals
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }

  /**
   * Remove item from cart
   */
  async removeItem(
    userId: string | null,
    sessionId: string | null,
    itemId: string,
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Check if item exists and belongs to cart
    const [item] = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.cartId, cart.id)))
      .limit(1);

    if (!item) {
      throw new NotFoundException("Cart item not found");
    }

    // Delete item
    await db.delete(cartItems).where(eq(cartItems.id, itemId));

    // Recalculate totals
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }

  /**
   * Clear cart
   */
  async clearCart(userId: string | null, sessionId: string | null) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Delete all cart items
    await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));

    // Reset cart totals
    await db
      .update(carts)
      .set({
        subtotal: 0,
        gstAmount: 0,
        total: 0,
      })
      .where(eq(carts.id, cart.id));

    return this.getCart(userId, sessionId);
  }

  /**
   * Merge guest cart into customer cart on login
   */
  async mergeGuestCart(userId: string, sessionId: string) {
    const customerId = await this.getCustomerId(userId);
    if (!customerId) {
      throw new NotFoundException("Customer profile not found");
    }

    // Get guest cart
    const [guestCart] = await db
      .select()
      .from(carts)
      .where(eq(carts.sessionId, sessionId))
      .limit(1);

    if (!guestCart || !guestCart.sessionId) {
      return; // No guest cart to merge
    }

    // Get or create customer cart
    const customerCart = await this.getOrCreateCart(customerId, null);

    // Get guest cart items
    const guestItems = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, guestCart.id));

    // Merge items
    for (const guestItem of guestItems) {
      // Check if item already exists in customer cart
      const [existingItem] = await db
        .select()
        .from(cartItems)
        .where(
          and(
            eq(cartItems.cartId, customerCart.id),
            eq(cartItems.productVariantId, guestItem.productVariantId),
          ),
        )
        .limit(1);

      if (existingItem) {
        // Update quantity (add guest quantity)
        await db
          .update(cartItems)
          .set({ quantity: existingItem.quantity + guestItem.quantity })
          .where(eq(cartItems.id, existingItem.id));
      } else {
        // Create new item in customer cart
        await db.insert(cartItems).values({
          cartId: customerCart.id,
          productVariantId: guestItem.productVariantId,
          quantity: guestItem.quantity,
          price: guestItem.price,
        });
      }
    }

    // Delete guest cart
    await db.delete(carts).where(eq(carts.id, guestCart.id));

    // Recalculate customer cart totals
    await this.recalculateCartTotals(customerCart.id, customerId);
  }

  /**
   * Apply discount code to cart
   */
  async applyDiscount(
    userId: string | null,
    sessionId: string | null,
    discountCode: string,
  ) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Validate discount
    const userIdForValidation = customerId
      ? await this.getUserIdFromCustomerId(customerId)
      : undefined;

    // Get cart subtotal for validation
    const items = await db
      .select({
        price: cartItems.price,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));

    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const validation = await this.discountsService.validateDiscount(
      discountCode,
      userIdForValidation,
      subtotal,
    );

    if (!validation.isValid || !validation.discount) {
      throw new BadRequestException(
        validation.error || "Invalid discount code",
      );
    }

    // Apply discount code
    await db.update(carts).set({ discountCode }).where(eq(carts.id, cart.id));

    // Recalculate totals with discount
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }

  /**
   * Remove discount code from cart
   */
  async removeDiscount(userId: string | null, sessionId: string | null) {
    let customerId: string | null = null;
    if (userId) {
      customerId = await this.getCustomerId(userId);
    }

    const cart = await this.getOrCreateCart(customerId, sessionId);

    // Remove discount code
    await db
      .update(carts)
      .set({ discountCode: null, discountAmount: 0 })
      .where(eq(carts.id, cart.id));

    // Recalculate totals without discount
    await this.recalculateCartTotals(cart.id, customerId);

    return this.getCart(userId, sessionId);
  }
}
