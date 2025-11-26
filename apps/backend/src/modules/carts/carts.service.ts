import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
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

@Injectable()
export class CartsService {
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
   * Recalculate cart totals
   */
  private async recalculateCartTotals(cartId: string) {
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

    // Calculate subtotal
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Get GST rates from products
    const productIds = [...new Set(items.map((item) => item.productId))];
    const productGstRates = await db
      .select({
        id: products.id,
        gstRate: products.gstRate,
      })
      .from(products)
      .where(
        productIds.length > 0
          ? // @ts-expect-error - inArray type issue
            require("@vcecom/db").inArray(products.id, productIds)
          : undefined,
      );

    const gstRateMap = new Map(productGstRates.map((p) => [p.id, p.gstRate]));

    // Calculate GST amount (simplified - using average GST rate for now)
    // Phase 3.4 will implement proper CGST/SGST/IGST calculation
    const totalGstAmount = items.reduce((sum, item) => {
      const gstRate = gstRateMap.get(item.productId) || 0;
      return sum + (item.price * item.quantity * gstRate) / 100;
    }, 0);

    const total = subtotal + totalGstAmount;

    // Update cart totals
    await db
      .update(carts)
      .set({
        subtotal,
        gstAmount: totalGstAmount,
        total,
      })
      .where(eq(carts.id, cartId));

    return { subtotal, gstAmount: totalGstAmount, total };
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

    // Get cart items
    const items = await db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id));

    // Recalculate totals
    await this.recalculateCartTotals(cart.id);

    // Get updated cart
    const [updatedCart] = await db
      .select()
      .from(carts)
      .where(eq(carts.id, cart.id))
      .limit(1);

    return {
      ...updatedCart,
      items,
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
    await this.recalculateCartTotals(cart.id);

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
    await this.recalculateCartTotals(cart.id);

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
    await this.recalculateCartTotals(customerCart.id);
  }
}
