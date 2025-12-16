import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { RedisKeyBuilder } from "../redis-key-builder";
import { RedisTTL } from "../redis-ttl.config";
import { BaseStore } from "./base.store";

/**
 * Store for managing inventory cache and reservations in Redis
 */
@Injectable()
export class InventoryStore extends BaseStore {
  constructor(@Inject("REDIS_CLIENT") redis: Redis) {
    super(redis, "inventory");
  }

  /**
   * Get cached inventory count for a product variant
   * @param variantId - Product variant ID
   * @returns Cached inventory count or null if not cached
   */
  async getInventory(variantId: string): Promise<number | null> {
    const key = RedisKeyBuilder.inventory(variantId);
    return this.getNumber(key);
  }

  /**
   * Cache inventory count for a product variant
   * @param variantId - Product variant ID
   * @param quantity - Inventory quantity
   */
  async setInventory(variantId: string, quantity: number): Promise<void> {
    const key = RedisKeyBuilder.inventory(variantId);
    await this.setNumber(key, quantity, RedisTTL.INVENTORY);
  }

  /**
   * Atomically increment or decrement inventory count
   * @param variantId - Product variant ID
   * @param delta - Positive number to increment, negative to decrement
   * @returns New inventory count after operation
   */
  async incrementInventory(variantId: string, delta: number): Promise<number> {
    const key = RedisKeyBuilder.inventory(variantId);
    const newValue = await this.increment(key, delta);

    // Refresh TTL after increment
    await this.expire(key, RedisTTL.INVENTORY);

    return newValue;
  }

  /**
   * Reserve inventory for checkout
   * Creates a reservation record and checks available inventory
   * @param variantId - Product variant ID
   * @param quantity - Quantity to reserve
   * @param reservationId - Unique reservation ID (e.g., order ID or checkout ID)
   * @param ttl - TTL for reservation in seconds (default: checkout TTL)
   * @returns true if reservation successful, false if insufficient inventory
   */
  async reserveInventory(
    variantId: string,
    quantity: number,
    reservationId: string,
    ttl: number = RedisTTL.CHECKOUT,
  ): Promise<boolean> {
    const inventoryKey = RedisKeyBuilder.inventory(variantId);
    const reservationKey = RedisKeyBuilder.inventoryReservation(
      variantId,
      reservationId,
    );

    // Get current inventory
    const currentInventoryStr = await this.redis.get(inventoryKey);
    const currentInventory = currentInventoryStr
      ? parseInt(currentInventoryStr, 10)
      : null;

    // If inventory not cached, we can't make a reservation
    // Caller should check database first
    if (currentInventory === null) {
      return false;
    }

    // Get all existing reservations for this variant
    const reservationPattern = RedisKeyBuilder.inventoryReservation(
      variantId,
      "*",
    );
    const reservationKeys = await this.redis.keys(reservationPattern);
    let reservedQuantity = 0;

    if (reservationKeys.length > 0) {
      const reservationValues = await this.redis.mget(...reservationKeys);
      reservedQuantity = reservationValues.reduce((sum, val) => {
        return sum + (val ? parseInt(val, 10) : 0);
      }, 0);
    }

    // Check if enough inventory is available
    const availableInventory = currentInventory - reservedQuantity;
    if (availableInventory < quantity) {
      return false;
    }

    // Create reservation
    await this.setNumber(reservationKey, quantity, ttl);
    return true;
  }

  /**
   * Release a reservation
   * @param variantId - Product variant ID
   * @param reservationId - Reservation ID to release
   */
  async releaseReservation(
    variantId: string,
    reservationId: string,
  ): Promise<void> {
    const reservationKey = RedisKeyBuilder.inventoryReservation(
      variantId,
      reservationId,
    );
    await this.delete(reservationKey);
  }

  /**
   * Get total reserved quantity for a variant
   * @param variantId - Product variant ID
   * @returns Total reserved quantity
   */
  async getReservedQuantity(variantId: string): Promise<number> {
    const pattern = RedisKeyBuilder.inventoryReservation(variantId, "*");
    const reservationKeys = await this.keys(pattern);

    if (reservationKeys.length === 0) {
      return 0;
    }

    const reservationValues = await this.redis.mget(...reservationKeys);
    return reservationValues.reduce((sum, val) => {
      return sum + (val ? parseInt(val, 10) : 0);
    }, 0);
  }

  /**
   * Invalidate inventory cache for a variant
   * @param variantId - Product variant ID
   */
  async invalidateInventory(variantId: string): Promise<void> {
    const key = RedisKeyBuilder.inventory(variantId);
    await this.delete(key);
  }

  /**
   * Invalidate all reservations for a variant
   * Useful when inventory is updated from admin
   * @param variantId - Product variant ID
   */
  async invalidateReservations(variantId: string): Promise<void> {
    const pattern = RedisKeyBuilder.inventoryReservation(variantId, "*");
    const reservationKeys = await this.keys(pattern);

    if (reservationKeys.length > 0) {
      await this.redis.del(...reservationKeys);
    }
  }
}
