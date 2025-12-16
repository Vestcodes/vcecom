import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  db,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  productSales,
  products,
} from "@vcecom/db";
import { CreateSaleDto } from "./dto/create-sale.dto";
import {
  EffectivePriceResponseDto,
  SaleResponseDto,
} from "./dto/sale-response.dto";
import { UpdateSaleDto } from "./dto/update-sale.dto";

@Injectable()
export class SalesService {
  /**
   * Get active sale price for a product
   * Returns sale price if active sale exists, otherwise returns regular price
   */
  async getEffectivePrice(
    productId: string,
  ): Promise<EffectivePriceResponseDto> {
    const now = new Date();

    // Get product first
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    // Find active sale
    const [activeSale] = await db
      .select()
      .from(productSales)
      .where(
        and(
          eq(productSales.productId, productId),
          eq(productSales.isActive, true),
          eq(productSales.status, "active"),
          // Date range check
          or(
            // No date range (always active)
            and(isNull(productSales.startDate), isNull(productSales.endDate)),
            // Within date range
            and(
              or(
                isNull(productSales.startDate),
                lte(productSales.startDate, now),
              ),
              or(isNull(productSales.endDate), gte(productSales.endDate, now)),
            ),
          ),
        ),
      )
      .orderBy(desc(productSales.priority)) // Highest priority first
      .limit(1);

    if (activeSale) {
      return {
        price: Number(product.price),
        salePrice: Number(activeSale.salePrice),
        isOnSale: true,
        saleId: activeSale.id,
      };
    }

    return {
      price: Number(product.price),
      salePrice: null,
      isOnSale: false,
    };
  }

  /**
   * Get active sales for multiple products (batch operation)
   * Optimized for cart/order calculations
   */
  async getEffectivePricesForProducts(
    productIds: string[],
  ): Promise<Map<string, { price: number; salePrice: number | null }>> {
    if (productIds.length === 0) return new Map();

    const now = new Date();

    // Get all products
    const allProducts = await db
      .select()
      .from(products)
      .where(inArray(products.id, productIds));

    // Get all active sales for these products
    const activeSales = await db
      .select()
      .from(productSales)
      .where(
        and(
          inArray(productSales.productId, productIds),
          eq(productSales.isActive, true),
          eq(productSales.status, "active"),
          or(
            // No date range (always active)
            and(isNull(productSales.startDate), isNull(productSales.endDate)),
            // Within date range
            and(
              or(
                isNull(productSales.startDate),
                lte(productSales.startDate, now),
              ),
              or(isNull(productSales.endDate), gte(productSales.endDate, now)),
            ),
          ),
        ),
      )
      .orderBy(desc(productSales.priority));

    // Create map: productId -> sale (highest priority)
    const saleMap = new Map<string, (typeof activeSales)[0]>();
    for (const sale of activeSales) {
      if (!saleMap.has(sale.productId)) {
        saleMap.set(sale.productId, sale);
      }
    }

    // Build result map
    const result = new Map();
    for (const product of allProducts) {
      const sale = saleMap.get(product.id);
      result.set(product.id, {
        price: Number(product.price),
        salePrice: sale ? Number(sale.salePrice) : null,
      });
    }

    return result;
  }

  /**
   * Create a new sale
   */
  async create(createSaleDto: CreateSaleDto): Promise<SaleResponseDto> {
    // Validate product exists
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, createSaleDto.productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(
        `Product ${createSaleDto.productId} not found`,
      );
    }

    // Validate sale price is less than regular price
    if (createSaleDto.salePrice >= product.price) {
      throw new BadRequestException(
        "Sale price must be less than regular price",
      );
    }

    // Validate date range
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (createSaleDto.startDate) {
      startDate = new Date(createSaleDto.startDate);
    }
    if (createSaleDto.endDate) {
      endDate = new Date(createSaleDto.endDate);
    }

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException("Start date must be before end date");
    }

    // Determine status based on dates
    const now = new Date();
    let status: "scheduled" | "active" | "expired" = "scheduled";

    if (startDate && endDate) {
      if (now < startDate) {
        status = "scheduled";
      } else if (now >= startDate && now <= endDate) {
        status = "active";
      } else {
        status = "expired";
      }
    } else if (!startDate && !endDate) {
      // Always active
      status = "active";
    } else if (startDate && now >= startDate) {
      status = "active";
    } else if (endDate && now <= endDate) {
      status = "active";
    } else if (startDate && now < startDate) {
      status = "scheduled";
    } else if (endDate && now > endDate) {
      status = "expired";
    }

    const [sale] = await db
      .insert(productSales)
      .values({
        productId: createSaleDto.productId,
        salePrice: createSaleDto.salePrice,
        startDate,
        endDate,
        status,
        isActive: createSaleDto.isActive ?? true,
        name: createSaleDto.name || null,
        description: createSaleDto.description || null,
        priority: createSaleDto.priority ?? 0,
      })
      .returning();

    return this.mapToDto(sale);
  }

  /**
   * Get sale by ID
   */
  async findOne(id: string): Promise<SaleResponseDto> {
    const [sale] = await db
      .select()
      .from(productSales)
      .where(eq(productSales.id, id))
      .limit(1);

    if (!sale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    return this.mapToDto(sale);
  }

  /**
   * Get all sales with optional filters
   */
  async findAll(
    productId?: string,
    status?: "scheduled" | "active" | "expired" | "disabled",
  ) {
    const conditions: ReturnType<typeof eq>[] = [];

    if (productId) {
      conditions.push(eq(productSales.productId, productId));
    }

    if (status) {
      conditions.push(eq(productSales.status, status));
    }

    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    const allSales = await db
      .select()
      .from(productSales)
      .where(whereCondition)
      .orderBy(desc(productSales.priority), desc(productSales.createdAt));

    return allSales.map((sale) => this.mapToDto(sale));
  }

  /**
   * Update sale
   */
  async update(
    id: string,
    updateSaleDto: UpdateSaleDto,
  ): Promise<SaleResponseDto> {
    const [existingSale] = await db
      .select()
      .from(productSales)
      .where(eq(productSales.id, id))
      .limit(1);

    if (!existingSale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    // If sale price is being updated, validate it
    if (updateSaleDto.salePrice !== undefined) {
      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, existingSale.productId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(
          `Product ${existingSale.productId} not found`,
        );
      }

      if (updateSaleDto.salePrice >= product.price) {
        throw new BadRequestException(
          "Sale price must be less than regular price",
        );
      }
    }

    // Validate date range if both dates are provided
    let startDate = existingSale.startDate;
    let endDate = existingSale.endDate;

    if (updateSaleDto.startDate !== undefined) {
      startDate = updateSaleDto.startDate
        ? new Date(updateSaleDto.startDate)
        : null;
    }
    if (updateSaleDto.endDate !== undefined) {
      endDate = updateSaleDto.endDate ? new Date(updateSaleDto.endDate) : null;
    }

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException("Start date must be before end date");
    }

    // Update status based on dates if dates changed
    let status = existingSale.status;
    if (
      updateSaleDto.startDate !== undefined ||
      updateSaleDto.endDate !== undefined
    ) {
      const now = new Date();
      if (startDate && endDate) {
        if (now < startDate) {
          status = "scheduled";
        } else if (now >= startDate && now <= endDate) {
          status = "active";
        } else {
          status = "expired";
        }
      } else if (!startDate && !endDate) {
        status = "active";
      } else if (startDate && now >= startDate) {
        status = "active";
      } else if (endDate && now <= endDate) {
        status = "active";
      } else if (startDate && now < startDate) {
        status = "scheduled";
      } else if (endDate && now > endDate) {
        status = "expired";
      }
    }

    const updateData: Partial<typeof productSales.$inferInsert> = {
      ...(updateSaleDto.salePrice !== undefined && {
        salePrice: updateSaleDto.salePrice,
      }),
      ...(updateSaleDto.startDate !== undefined && { startDate }),
      ...(updateSaleDto.endDate !== undefined && { endDate }),
      ...(updateSaleDto.name !== undefined && { name: updateSaleDto.name }),
      ...(updateSaleDto.description !== undefined && {
        description: updateSaleDto.description,
      }),
      ...(updateSaleDto.priority !== undefined && {
        priority: updateSaleDto.priority,
      }),
      ...(updateSaleDto.isActive !== undefined && {
        isActive: updateSaleDto.isActive,
      }),
      status,
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(productSales)
      .set(updateData)
      .where(eq(productSales.id, id))
      .returning();

    return this.mapToDto(updated);
  }

  /**
   * Update sale status (manual toggle)
   */
  async updateStatus(id: string, isActive: boolean): Promise<SaleResponseDto> {
    const [sale] = await db
      .select()
      .from(productSales)
      .where(eq(productSales.id, id))
      .limit(1);

    if (!sale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    const [updated] = await db
      .update(productSales)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(productSales.id, id))
      .returning();

    return this.mapToDto(updated);
  }

  /**
   * Delete sale
   */
  async remove(id: string): Promise<void> {
    const [sale] = await db
      .select()
      .from(productSales)
      .where(eq(productSales.id, id))
      .limit(1);

    if (!sale) {
      throw new NotFoundException(`Sale ${id} not found`);
    }

    await db.delete(productSales).where(eq(productSales.id, id));
  }

  /**
   * Update sale statuses based on date ranges (cron job)
   * Should be called periodically to update sale statuses
   */
  async updateSaleStatuses(): Promise<void> {
    const now = new Date();

    // Update expired sales
    await db
      .update(productSales)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(productSales.status, "active"),
          isNotNull(productSales.endDate),
          lte(productSales.endDate, now),
        ),
      );

    // Activate scheduled sales
    await db
      .update(productSales)
      .set({ status: "active", updatedAt: now })
      .where(
        and(
          eq(productSales.status, "scheduled"),
          or(isNull(productSales.startDate), lte(productSales.startDate, now)),
          or(isNull(productSales.endDate), gte(productSales.endDate, now)),
        ),
      );
  }

  /**
   * Map database sale to DTO
   */
  private mapToDto(sale: typeof productSales.$inferSelect): SaleResponseDto {
    return {
      id: sale.id,
      productId: sale.productId,
      salePrice: Number(sale.salePrice),
      startDate: sale.startDate,
      endDate: sale.endDate,
      status: sale.status as SaleResponseDto["status"],
      isActive: sale.isActive,
      name: sale.name,
      description: sale.description,
      priority: sale.priority,
      createdAt: sale.createdAt,
      updatedAt: sale.updatedAt,
    };
  }
}
