import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  and,
  asc,
  categories,
  collections,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  notInArray,
  or,
  productCollections,
  productImages,
  products,
  productVariantOptionTypes,
  productVariants,
  sql,
  stores,
  variantOptionTypes,
  variantOptionValues,
} from "@vcecom/db";
import Fuse from "fuse.js";
import { PinoLogger } from "nestjs-pino";
import { ContextService } from "../../common/logging/context.service";
import {
  createErrorContext,
  createLogContext,
} from "../../common/logging/logging.helper";
import { Trace } from "../../common/tracing/trace.decorator";
import {
  calculateBasePrice,
  calculateGstAmount,
  calculateGstFromInclusivePrice,
  calculatePriceWithGst,
  isValidGstRate,
} from "../../common/utils/gst.utils";
import {
  generatePaginationMetadata,
  normalizePaginationParams,
} from "../../common/utils/pagination.utils";
import {
  calculateRelevanceScore,
  isLikelySku,
  parseSearchQuery,
} from "../../common/utils/search.utils";
import {
  generateSlug,
  generateUniqueSlug,
} from "../../common/utils/slug.utils";
import { DB_TOKEN } from "../database/database.module";
import type { Database } from "../database/db";
import { ProductEventsService } from "../events/product-events.service";
import { calculatePriceAfterOverride } from "../pricing/engine/override-strategies/price-override.strategy";
import { PriceListService } from "../pricing/services/price-list.service";
import { ProductsIndexingService } from "../search/indexing/products-indexing.service";
import { SearchQueryService } from "../search/search-query.service";
import { StorageService } from "../storage/storage.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { FilterProductsDto, SortField, SortOrder } from "./dto/filter.dto";
import {
  PaginatedProductsResponseDto,
  ProductResponseDto,
} from "./dto/product-response.dto";
import { QueryProductsDto } from "./dto/query-products.dto";
import {
  SearchProductsDto,
  SearchResponseDto,
  SearchResultDto,
  SearchSortBy,
} from "./dto/search.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { MediaCacheInvalidationService } from "./services/media-cache-invalidation.service";
import { MediaTransactionService } from "./services/media-transaction.service";

@Injectable()
export class ProductsService {
  constructor(
    private readonly storageService: StorageService,
    @Inject(DB_TOKEN) private readonly db: Database, // Inject DB instance via DIreadonly _storeContextService: StoreContextService,
    private readonly priceListService?: PriceListService,
    private readonly mediaTransactionService?: MediaTransactionService,
    private readonly mediaCacheInvalidationService?: MediaCacheInvalidationService,
    private readonly productEventsService?: ProductEventsService,
    @Optional()
    @Inject(forwardRef(() => ProductsIndexingService))
    private readonly productsIndexingService?: ProductsIndexingService,
    @Optional()
    @Inject(forwardRef(() => SearchQueryService))
    private readonly searchQueryService?: SearchQueryService,
    private readonly logger?: PinoLogger,
    private readonly contextService?: ContextService,
  ) {}
  /**
   * Create a new product
   */
  async create(createProductDto: CreateProductDto) {
    // Validate category exists if provided
    if (createProductDto.categoryId) {
      const [category] = await this.db
        .select()
        .from(categories)
        .where(eq(categories.id, createProductDto.categoryId))
        .limit(1);

      if (!category) {
        throw new BadRequestException(
          `Category with ID ${createProductDto.categoryId} not found`,
        );
      }
    }

    // Validate GST rate
    const gstRate = createProductDto.gstRate ?? 0;
    if (!isValidGstRate(gstRate)) {
      throw new BadRequestException(
        `Invalid GST rate. Valid rates are: 0%, 5%, 12%, 18%, 28%`,
      );
    }

    // Generate slug if not provided
    let slug = createProductDto.slug;
    if (!slug) {
      slug = generateSlug(createProductDto.title);
      // Ensure uniqueness
      const existingSlugs = await this.db
        .select({ slug: products.slug })
        .from(products)
        .where(eq(products.slug, slug))
        .limit(10);
      const slugList = existingSlugs.map((p) => p.slug || "").filter(Boolean);
      slug = generateUniqueSlug(slug, slugList);
    }

    // Create product
    const [newProduct] = await this.db
      .insert(products)
      .values({
        storeId: await this.getDefaultStoreId(),
        title: createProductDto.title,
        description: createProductDto.description || null,
        price: createProductDto.price,
        gstRate,
        pricingType: createProductDto.pricingType || "exclusive",
        hsnCode: createProductDto.hsnCode || null,
        slug: slug || null,
        status: createProductDto.status || "draft",
        categoryId: createProductDto.categoryId || null,
      })
      .returning();

    // Slug registration removed - no longer using CMS route registry

    // Emit product created event
    if (this.productEventsService) {
      const storeId = await this.getDefaultStoreId();
      await this.productEventsService.emitProductCreated({
        productId: newProduct.id,
        storeId,
        title: newProduct.title,
        handle: newProduct.slug || undefined,
        status: newProduct.status,
        timestamp: new Date(),
      });
    }

    // Index product for search
    if (this.productsIndexingService) {
      this.productsIndexingService
        .indexProduct(newProduct.id)
        .catch((error) => {
          this.logger?.warn?.(
            this.contextService
              ? createLogContext(
                  this.contextService,
                  "ProductsService.create.indexProduct",
                  {
                    productId: newProduct.id,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                )
              : {
                  operation: "ProductsService.create.indexProduct",
                  productId: newProduct.id,
                },
            "Failed to index product (non-blocking)",
          );
        });
    }

    return this.enrichProductWithGst(newProduct);
  }

  /**
   * Get default store ID helper
   */
  private async getDefaultStoreId(): Promise<string> {
    const [defaultStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.isDefault, true))
      .limit(1);

    if (defaultStore) {
      return defaultStore.id;
    }

    const [firstStore] = await this.db
      .select({ id: stores.id })
      .from(stores)
      .limit(1);
    if (firstStore) {
      return firstStore.id;
    }

    throw new Error("No store found");
  }

  /**
   * Get all products with pagination, search, and filters
   */
  @Trace({ operation: "ProductsService.findAll" })
  async findAll(
    query: QueryProductsDto,
  ): Promise<PaginatedProductsResponseDto> {
    const { page, limit, offset } = normalizePaginationParams(
      query.page,
      query.limit,
    );

    // Build where conditions array
    const conditions: ReturnType<
      | typeof eq
      | typeof and
      | typeof or
      | typeof gte
      | typeof lte
      | typeof ilike
    >[] = [];

    // Search condition (title, description, or SKU)
    if (query.search) {
      const searchPattern = `%${query.search}%`;
      const searchConditions = [
        ilike(products.title, searchPattern),
        ilike(products.description, searchPattern),
      ];

      // Search in variants SKU if search term looks like SKU
      if (query.search.length <= 50) {
        // Get product IDs that have matching SKUs
        let variantsWithMatchingSku: Array<{ productId: string }>;
        try {
          variantsWithMatchingSku = await this.db
            .select({ productId: productVariants.productId })
            .from(productVariants)
            .where(ilike(productVariants.sku, searchPattern));
        } catch (error) {
          this.logger?.warn(
            this.contextService
              ? createLogContext(
                  this.contextService,
                  "ProductsService.findAll.searchVariants",
                  {
                    search: query.search,
                    error:
                      error instanceof Error ? error.message : String(error),
                  },
                )
              : {
                  operation: "ProductsService.findAll.searchVariants",
                  search: query.search,
                  error: error instanceof Error ? error.message : String(error),
                },
            "Failed to search variants by SKU, continuing with product search",
          );
          variantsWithMatchingSku = [];
        }

        if (variantsWithMatchingSku.length > 0) {
          const productIds = variantsWithMatchingSku.map((v) => v.productId);
          searchConditions.push(inArray(products.id, productIds));
        }
      }

      conditions.push(or(...searchConditions));
    }

    // Status filter
    if (query.status) {
      conditions.push(eq(products.status, query.status));
    }

    // Category filter
    if (query.categoryId) {
      conditions.push(eq(products.categoryId, query.categoryId));
    }

    // Price range filters
    if (query.minPrice !== undefined) {
      conditions.push(gte(products.price, query.minPrice));
    }
    if (query.maxPrice !== undefined) {
      conditions.push(lte(products.price, query.maxPrice));
    }

    // Availability filter (in stock/out of stock)
    if (query.inStock !== undefined) {
      // Get products with at least one variant with inventory > 0
      let productsInStock: Array<{ productId: string }>;
      try {
        productsInStock = await this.db
          .select({ productId: productVariants.productId })
          .from(productVariants)
          .where(sql`${productVariants.inventory} > 0`);
      } catch (error) {
        this.logger?.error(
          this.contextService
            ? createErrorContext(
                this.contextService,
                "ProductsService.findAll.selectProductsInStock",
                error,
                { inStock: query.inStock },
              )
            : {
                operation: "ProductsService.findAll.selectProductsInStock",
                error: error instanceof Error ? error.message : String(error),
                inStock: query.inStock,
              },
          "Failed to fetch products in stock",
        );
        productsInStock = [];
      }

      // Get unique product IDs
      const productIdsInStock: string[] = Array.from(
        new Set(productsInStock.map((p: { productId: string }) => p.productId)),
      );

      if (query.inStock) {
        // Filter to only products in stock
        if (productIdsInStock.length > 0) {
          conditions.push(inArray(products.id, productIdsInStock));
        } else {
          // No products in stock, return empty result
          const pagination = generatePaginationMetadata(0, page, limit);
          return {
            data: [],
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages,
            hasNextPage: pagination.hasNextPage,
            hasPreviousPage: pagination.hasPreviousPage,
          };
        }
      } else {
        // Filter to only products out of stock (not in the in-stock list)
        if (productIdsInStock.length > 0) {
          conditions.push(
            notInArray(products.id, productIdsInStock as string[]),
          );
        }
        // If no products are in stock, all products are out of stock, so no additional filter needed
      }
    }

    // Build final where condition
    let whereCondition: ReturnType<typeof and> | undefined;
    if (conditions.length > 0) {
      whereCondition = and(...conditions);
    }

    // Get total count using COUNT(*) for performance
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereCondition || undefined);
    const total = Number(countResult[0]?.count || 0);

    // Build sort order
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sortOrder || "desc";
    let orderBy: ReturnType<typeof asc> | ReturnType<typeof desc>;
    if (sortBy === "price") {
      orderBy =
        sortOrder === "asc" ? asc(products.price) : desc(products.price);
    } else if (sortBy === "name") {
      orderBy =
        sortOrder === "asc" ? asc(products.title) : desc(products.title);
    } else {
      // date (default)
      orderBy =
        sortOrder === "asc"
          ? asc(products.createdAt)
          : desc(products.createdAt);
    }

    // Get products
    const productsQuery = this.db.select().from(products);
    if (whereCondition) {
      productsQuery.where(whereCondition);
    }
    const allProducts = await productsQuery
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy);

    const pagination = generatePaginationMetadata(Number(total), page, limit);

    // Get first images for all products
    const productIds = allProducts.map((p) => p.id);
    const firstImages = await this.getFirstImagesForProducts(productIds);

    return {
      data: allProducts.map((product) => ({
        ...this.enrichProductWithGst(product),
        thumbnailUrl: firstImages.get(product.id) || null,
      })),
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPreviousPage: pagination.hasPreviousPage,
    };
  }

  /**
   * Filter products with advanced filtering and sorting options
   * Supports filtering by category, price range, availability, and status
   * Supports sorting by price, name, or date
   */
  async filter(
    filterDto: FilterProductsDto,
  ): Promise<PaginatedProductsResponseDto> {
    const { page, limit, offset } = normalizePaginationParams(
      filterDto.page,
      filterDto.limit,
    );

    // Build where conditions array
    const conditions: ReturnType<
      typeof eq | typeof and | typeof gte | typeof lte | typeof inArray
    >[] = [];

    // Status filter
    if (filterDto.status) {
      conditions.push(eq(products.status, filterDto.status));
    }

    // Category filter
    if (filterDto.categoryId) {
      conditions.push(eq(products.categoryId, filterDto.categoryId));
    }

    // Price range filters
    if (filterDto.minPrice !== undefined) {
      conditions.push(gte(products.price, filterDto.minPrice));
    }
    if (filterDto.maxPrice !== undefined) {
      conditions.push(lte(products.price, filterDto.maxPrice));
    }

    // Availability filter (in stock/out of stock)
    if (filterDto.inStock !== undefined) {
      // Get products with at least one variant with inventory > 0
      const productsInStock = await this.db
        .select({ productId: productVariants.productId })
        .from(productVariants)
        .where(sql`${productVariants.inventory} > 0`);

      // Get unique product IDs
      const productIdsInStock: string[] = Array.from(
        new Set(productsInStock.map((p) => p.productId)),
      );

      if (filterDto.inStock) {
        // Filter to only products in stock
        if (productIdsInStock.length > 0) {
          conditions.push(inArray(products.id, productIdsInStock));
        } else {
          // No products in stock, return empty result
          const pagination = generatePaginationMetadata(0, page, limit);
          return {
            data: [],
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages,
            hasNextPage: pagination.hasNextPage,
            hasPreviousPage: pagination.hasPreviousPage,
          };
        }
      } else {
        // Filter to only products out of stock (not in the in-stock list)
        if (productIdsInStock.length > 0) {
          conditions.push(
            notInArray(products.id, productIdsInStock as string[]),
          );
        }
        // If no products are in stock, all products are out of stock, so no additional filter needed
      }
    }

    // Build final where condition
    let whereCondition: ReturnType<typeof and> | undefined;
    if (conditions.length > 0) {
      whereCondition = and(...conditions);
    }

    // Get total count using COUNT(*) for performance
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereCondition || undefined);
    const total = Number(countResult[0]?.count || 0);

    // Build sort order
    const sortBy = filterDto.sortBy || SortField.DATE;
    const sortOrder = filterDto.sortOrder || SortOrder.DESC;
    let orderBy: ReturnType<typeof asc> | ReturnType<typeof desc>;
    if (sortBy === SortField.PRICE) {
      orderBy =
        sortOrder === SortOrder.ASC
          ? asc(products.price)
          : desc(products.price);
    } else if (sortBy === SortField.NAME) {
      orderBy =
        sortOrder === SortOrder.ASC
          ? asc(products.title)
          : desc(products.title);
    } else {
      // DATE (default)
      orderBy =
        sortOrder === SortOrder.ASC
          ? asc(products.createdAt)
          : desc(products.createdAt);
    }

    // Get products
    const productsQuery = this.db.select().from(products);
    if (whereCondition) {
      productsQuery.where(whereCondition);
    }
    const allProducts = await productsQuery
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy);

    const pagination = generatePaginationMetadata(Number(total), page, limit);

    // Get first images for all products
    const productIds = allProducts.map((p) => p.id);
    const firstImages = await this.getFirstImagesForProducts(productIds);

    return {
      data: allProducts.map((product) => ({
        ...this.enrichProductWithGst(product),
        thumbnailUrl: firstImages.get(product.id) || null,
      })),
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPreviousPage: pagination.hasPreviousPage,
    };
  }

  /**
   * Get product by ID
   */
  @Trace({ operation: "ProductsService.findOne" })
  async findOne(id: string): Promise<ProductResponseDto> {
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Get all product images
    const images = await this.db
      .select({
        url: productImages.url,
      })
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, id),
          sql`${productImages.variantId} IS NULL`, // Only product-level images
        ),
      )
      .orderBy(asc(productImages.order));

    // Resolve S3 keys to URLs and URL encode
    const resolvedImages = await Promise.all(
      images.map(async (image) => {
        let url = image.url;
        if (this.isS3Key(image.url)) {
          try {
            url = await this.storageService.getUrl(image.url);
          } catch {
            // If S3 key resolution fails, keep original
            url = image.url;
          }
        }
        // URL encode the image URL
        return encodeURI(url);
      }),
    );

    const enrichedProduct = this.enrichProductWithGst(product);

    // Get pricelist prices for this product
    const pricelistPrices = await this.getPricelistPricesForProduct(
      id,
      enrichedProduct.priceIncludingGst,
      product.categoryId,
    );

    return {
      ...enrichedProduct,
      images: resolvedImages.length > 0 ? resolvedImages : null,
      pricelistPrices: pricelistPrices.length > 0 ? pricelistPrices : null,
    };
  }

  /**
   * Get pricelist prices for a product
   * Returns effective prices for all active pricelists that apply to this product
   */
  private async getPricelistPricesForProduct(
    productId: string,
    basePrice: number,
    categoryId: string | null = null,
  ): Promise<
    Array<{
      priceListId: string;
      priceListName: string;
      price: number;
      overrideType: string;
      overrideValue: number;
    }>
  > {
    if (!this.priceListService) {
      return [];
    }

    try {
      // Get active pricelists
      const activePriceLists = await this.priceListService.findActive();

      const pricelistPrices: Array<{
        priceListId: string;
        priceListName: string;
        price: number;
        overrideType: string;
        overrideValue: number;
      }> = [];

      for (const priceList of activePriceLists) {
        // Find product-level or category-level items for this product
        const applicableItem = priceList.items.find(
          (item) =>
            item.productId === productId ||
            (item.categoryId && item.categoryId === productId),
        );

        if (applicableItem) {
          // Calculate price after override
          const priceAfterOverride = calculatePriceAfterOverride(basePrice, {
            priceListId: priceList.id,
            priceListName: priceList.name,
            priority: priceList.priority,
            overrideType: applicableItem.overrideType,
            overrideValue: applicableItem.overrideValue,
            specificity:
              applicableItem.productId === productId ? "PRODUCT" : "CATEGORY",
          });

          // Apply GST calculation if needed (assuming same GST rate)
          // For now, use the price after override directly
          pricelistPrices.push({
            priceListId: priceList.id,
            priceListName: priceList.name,
            price: Math.round(priceAfterOverride * 100) / 100, // Round to 2 decimals
            overrideType: applicableItem.overrideType,
            overrideValue: applicableItem.overrideValue,
          });
        }
      }

      return pricelistPrices;
    } catch (error) {
      this.logger?.error(
        this.contextService
          ? createErrorContext(
              this.contextService,
              "ProductsService.getPricelistPricesForProduct",
              error,
              { productId },
            )
          : {
              operation: "ProductsService.getPricelistPricesForProduct",
              error: error instanceof Error ? error.message : String(error),
              productId,
            },
        "Failed to fetch pricelist prices",
      );
      return [];
    }
  }

  /**
   * Update a product
   */
  async update(id: string, updateProductDto: UpdateProductDto) {
    // Check if product exists
    const [existing] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Validate category exists if provided
    if (updateProductDto.categoryId) {
      const [category] = await this.db
        .select()
        .from(categories)
        .where(eq(categories.id, updateProductDto.categoryId))
        .limit(1);

      if (!category) {
        throw new BadRequestException(
          `Category with ID ${updateProductDto.categoryId} not found`,
        );
      }
    }

    // Generate slug if title changed or slug explicitly provided
    let newSlug: string | undefined;
    const _oldSlug = existing.slug;
    if (updateProductDto.slug !== undefined) {
      newSlug = updateProductDto.slug;
    } else if (updateProductDto.title !== undefined && !existing.slug) {
      // Generate slug if title changed and no slug exists
      newSlug = generateSlug(updateProductDto.title);
      // Ensure uniqueness
      const existingSlugs = await this.db
        .select({ slug: products.slug })
        .from(products)
        .where(and(eq(products.slug, newSlug), sql`${products.id} != ${id}`))
        .limit(10);
      const slugList = existingSlugs.map((p) => p.slug || "").filter(Boolean);
      newSlug = generateUniqueSlug(newSlug, slugList);
    }

    // Build update data
    const updateData: Partial<typeof products.$inferInsert> = {};
    if (updateProductDto.title !== undefined)
      updateData.title = updateProductDto.title;
    if (updateProductDto.description !== undefined)
      updateData.description = updateProductDto.description || null;
    if (updateProductDto.price !== undefined)
      updateData.price = updateProductDto.price;
    if (updateProductDto.gstRate !== undefined)
      updateData.gstRate = updateProductDto.gstRate;
    if (updateProductDto.pricingType !== undefined)
      updateData.pricingType = updateProductDto.pricingType;
    if (updateProductDto.status !== undefined)
      updateData.status = updateProductDto.status;
    if (updateProductDto.categoryId !== undefined)
      updateData.categoryId = updateProductDto.categoryId || null;
    if (newSlug !== undefined) updateData.slug = newSlug || null;

    // Update product
    const [updated] = await this.db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    // Slug registration removed - no longer using CMS route registry

    // Emit product updated event
    if (this.productEventsService) {
      const storeId = await this.getDefaultStoreId();
      const changes: Record<string, unknown> = {};
      if (updateProductDto.title !== undefined)
        changes.title = updateProductDto.title;
      if (updateProductDto.description !== undefined)
        changes.description = updateProductDto.description;
      if (updateProductDto.price !== undefined)
        changes.price = updateProductDto.price;
      if (updateProductDto.status !== undefined)
        changes.status = updateProductDto.status;

      // Check if status changed to/from active (published/unpublished)
      if (
        updateProductDto.status !== undefined &&
        existing.status !== updateProductDto.status
      ) {
        if (
          updateProductDto.status === "active" &&
          existing.status !== "active"
        ) {
          await this.productEventsService.emitProductPublished({
            productId: updated.id,
            storeId,
            title: updated.title,
            handle: updated.slug || undefined,
            publishedAt: new Date(),
            timestamp: new Date(),
          });
        } else if (
          existing.status === "active" &&
          updateProductDto.status !== "active"
        ) {
          await this.productEventsService.emitProductUnpublished({
            productId: updated.id,
            storeId,
            title: updated.title,
            handle: updated.slug || undefined,
            timestamp: new Date(),
          });
        }
      }

      await this.productEventsService.emitProductUpdated({
        productId: updated.id,
        storeId,
        title: updated.title,
        timestamp: new Date(),
      });
    }

    // Index product for search
    if (this.productsIndexingService) {
      this.productsIndexingService.indexProduct(updated.id).catch((error) => {
        this.logger?.warn?.(
          this.contextService
            ? createLogContext(
                this.contextService,
                "ProductsService.update.indexProduct",
                {
                  productId: updated.id,
                  error: error instanceof Error ? error.message : String(error),
                },
              )
            : {
                operation: "ProductsService.update.indexProduct",
                productId: updated.id,
              },
          "Failed to index product (non-blocking)",
        );
      });
    }

    return this.enrichProductWithGst(updated);
  }

  /**
   * Remove a product
   */
  async remove(id: string) {
    // Check if product exists
    const [existing] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Emit product deleted event before deletion
    if (this.productEventsService) {
      const storeId = await this.getDefaultStoreId();
      await this.productEventsService.emitProductDeleted({
        productId: existing.id,
        storeId,
        title: existing.title,
        handle: existing.slug || undefined,
        timestamp: new Date(),
      });
    }

    // Delete product (variants and images will be cascade deleted)
    await this.db.delete(products).where(eq(products.id, id));

    // Delete from search index
    if (this.productsIndexingService) {
      this.productsIndexingService.deleteProduct(id).catch((error) => {
        this.logger?.warn?.(
          this.contextService
            ? createLogContext(
                this.contextService,
                "ProductsService.remove.deleteProduct",
                {
                  productId: id,
                  error: error instanceof Error ? error.message : String(error),
                },
              )
            : {
                operation: "ProductsService.remove.deleteProduct",
                productId: id,
              },
          "Failed to delete product from index (non-blocking)",
        );
      });
    }

    return { message: "Product deleted successfully" };
  }

  /**
   * Advanced product search with full-text search, SKU search, and ranking
   * Uses indexed search if available, falls back to database search
   */
  @Trace({ operation: "ProductsService.search" })
  async search(searchDto: SearchProductsDto): Promise<SearchResponseDto> {
    // Try indexed search first if available
    if (this.searchQueryService) {
      try {
        const indexedResults = await this.searchQueryService.searchProducts(
          searchDto.query,
          {
            page: searchDto.page,
            limit: searchDto.limit,
            categoryId: searchDto.categoryId,
            minPrice: searchDto.minPrice,
            maxPrice: searchDto.maxPrice,
            inStock: searchDto.inStock,
            status: "active",
            sortBy:
              searchDto.sortBy === SearchSortBy.PRICE
                ? "price"
                : searchDto.sortBy === SearchSortBy.NAME
                  ? "title"
                  : searchDto.sortBy === SearchSortBy.DATE
                    ? "createdAt"
                    : undefined,
            sortOrder: searchDto.sortOrder,
          },
        );

        // Transform indexed results to SearchResponseDto format
        const results: SearchResultDto[] = indexedResults.results.map(
          (result) => ({
            id: result.document.id,
            title: result.document.title,
            description: result.document.description,
            price: result.document.price,
            relevanceScore: result.score || 0,
            matchingSku:
              result.document.variants.find((v) =>
                v.sku.toLowerCase().includes(searchDto.query.toLowerCase()),
              )?.sku || null,
          }),
        );

        return {
          results,
          total: indexedResults.total,
          page: indexedResults.page,
          limit: indexedResults.limit,
          totalPages: indexedResults.totalPages,
          hasNextPage: indexedResults.page < indexedResults.totalPages,
          hasPreviousPage: indexedResults.page > 1,
          query: searchDto.query,
        };
      } catch (error) {
        // Fall through to database search if indexed search fails
        this.logger?.debug?.(
          this.contextService
            ? createLogContext(
                this.contextService,
                "ProductsService.search.indexedSearchFailed",
                {
                  query: searchDto.query,
                  error: error instanceof Error ? error.message : String(error),
                },
              )
            : { operation: "ProductsService.search", query: searchDto.query },
          "Indexed search failed, falling back to database search",
        );
      }
    }

    // Fallback to existing database search implementation
    const { page, limit, offset } = normalizePaginationParams(
      searchDto.page,
      searchDto.limit,
    );

    // Parse search query
    const parsedQuery = parseSearchQuery(searchDto.query);

    // Build base conditions
    const conditions: ReturnType<
      | typeof eq
      | typeof and
      | typeof or
      | typeof gte
      | typeof lte
      | typeof inArray
    >[] = [];

    // Only search active products
    conditions.push(eq(products.status, "active"));

    // Category filter
    if (searchDto.categoryId) {
      conditions.push(eq(products.categoryId, searchDto.categoryId));
    }

    // Price range filters
    if (searchDto.minPrice !== undefined) {
      conditions.push(gte(products.price, searchDto.minPrice));
    }
    if (searchDto.maxPrice !== undefined) {
      conditions.push(lte(products.price, searchDto.maxPrice));
    }

    // Availability filter
    if (searchDto.inStock !== undefined) {
      const productsInStock = await this.db
        .select({ productId: productVariants.productId })
        .from(productVariants)
        .where(sql`${productVariants.inventory} > 0`);

      // Get unique product IDs
      const productIdsInStock: string[] = Array.from(
        new Set(productsInStock.map((p) => p.productId)),
      );

      if (searchDto.inStock) {
        if (productIdsInStock.length > 0) {
          conditions.push(inArray(products.id, productIdsInStock));
        } else {
          // No products in stock
          const pagination = generatePaginationMetadata(0, page, limit);
          return {
            results: [],
            total: pagination.total,
            page: pagination.page,
            limit: pagination.limit,
            totalPages: pagination.totalPages,
            hasNextPage: pagination.hasNextPage,
            hasPreviousPage: pagination.hasPreviousPage,
            query: searchDto.query,
          };
        }
      } else if (productIdsInStock.length > 0) {
        conditions.push(notInArray(products.id, productIdsInStock));
      }
    }

    // Build where condition
    const whereCondition =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Get all matching products (we'll filter and rank in memory for better relevance)
    const allProducts = await this.db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
        price: products.price,
        gstRate: products.gstRate,
        hsnCode: products.hsnCode,
        status: products.status,
        categoryId: products.categoryId,
        createdAt: products.createdAt,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .where(whereCondition);

    // Search in SKUs if query looks like SKU or contains SKU-like terms
    const isSkuSearch = isLikelySku(searchDto.query);
    const skuMatches = new Map<string, string>(); // productId -> matching SKU

    if (isSkuSearch || parsedQuery.keywords.some((k) => isLikelySku(k))) {
      const searchPatterns = parsedQuery.keywords
        .filter((k) => isLikelySku(k))
        .map((k) => `%${k}%`);

      if (searchPatterns.length > 0 || isSkuSearch) {
        const skuSearchPattern = isSkuSearch
          ? `%${searchDto.query}%`
          : searchPatterns[0];

        const variantsWithMatchingSku = await this.db
          .select({
            productId: productVariants.productId,
            sku: productVariants.sku,
          })
          .from(productVariants)
          .where(ilike(productVariants.sku, skuSearchPattern));

        variantsWithMatchingSku.forEach((v) => {
          if (!skuMatches.has(v.productId)) {
            skuMatches.set(v.productId, v.sku);
          }
        });
      }
    }

    // Add products found via SKU search
    if (skuMatches.size > 0) {
      const skuProductIds = Array.from(skuMatches.keys());
      const skuProducts = await this.db
        .select({
          id: products.id,
          title: products.title,
          description: products.description,
          price: products.price,
          gstRate: products.gstRate,
          hsnCode: products.hsnCode,
          status: products.status,
          categoryId: products.categoryId,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
        })
        .from(products)
        .where(
          and(
            eq(products.status, "active"),
            inArray(products.id, skuProductIds),
          ),
        );

      // Merge with existing products, avoiding duplicates
      const existingIds = new Set(allProducts.map((p) => p.id));
      skuProducts.forEach((p) => {
        if (!existingIds.has(p.id)) {
          allProducts.push(p);
        }
      });
    }

    // Filter out invalid products before search
    const validProducts = allProducts.filter(
      (p) => p?.title && typeof p.title === "string",
    );

    // Use Fuse.js for fuzzy search and ranking
    const fuse = new Fuse(validProducts, {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "description", weight: 0.3 },
      ],
      threshold: 0.4, // Lower = more strict matching
      includeScore: true,
      minMatchCharLength: 2,
    });

    // Perform search
    const fuseResults = fuse.search(searchDto.query);

    // Map results with relevance scores
    type ProductType = (typeof allProducts)[0];
    const resultsWithScores: Array<{
      product: ProductType;
      relevanceScore: number;
      matchingSku?: string | null;
    }> = fuseResults
      .filter(
        (result) =>
          result.item !== null &&
          result.item !== undefined &&
          typeof result.item === "object" &&
          "title" in result.item,
      )
      .map((result) => {
        const product = result.item as ProductType;
        const fuseScore = result.score || 1.0; // Lower score = better match in Fuse.js
        const customScore = calculateRelevanceScore(
          product,
          searchDto.query,
          parsedQuery,
          skuMatches.get(product.id),
        );

        // Combine Fuse.js score (inverted) with custom relevance score
        // Fuse.js score is 0-1 where 0 is perfect match
        // Custom score is 0-1 where 1 is perfect match
        const combinedScore = (1 - fuseScore) * 0.6 + customScore * 0.4;

        return {
          product,
          relevanceScore: Math.min(1.0, combinedScore),
          matchingSku: skuMatches.get(product.id) || null,
        };
      });

    // If no Fuse.js results but we have products (e.g., SKU match), include them
    // Only include products that have SKU matches or some text relevance
    if (fuseResults.length === 0 && validProducts.length > 0) {
      validProducts.forEach((product) => {
        // Ensure product has required fields
        if (!product || !product.title) {
          return;
        }

        const matchingSku = skuMatches.get(product.id);
        if (matchingSku) {
          // SKU match gets high relevance
          resultsWithScores.push({
            product,
            relevanceScore: 0.9,
            matchingSku,
          });
        } else {
          // Only include if there's some text match
          // Check if query appears in title or description
          const queryLower = searchDto.query.toLowerCase();
          const titleLower = product.title.toLowerCase();
          const descriptionLower = (product.description || "").toLowerCase();

          if (
            titleLower.includes(queryLower) ||
            descriptionLower.includes(queryLower)
          ) {
            const score = calculateRelevanceScore(
              product,
              searchDto.query,
              parsedQuery,
            );
            if (score > 0) {
              resultsWithScores.push({
                product,
                relevanceScore: score,
                matchingSku: null,
              });
            }
          }
        }
      });
    }

    // Sort by relevance or other criteria
    if (searchDto.sortBy === SearchSortBy.RELEVANCE) {
      resultsWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else if (searchDto.sortBy === SearchSortBy.PRICE) {
      resultsWithScores.sort((a, b) => {
        const priceDiff = a.product.price - b.product.price;
        return searchDto.sortOrder === "asc" ? priceDiff : -priceDiff;
      });
    } else if (searchDto.sortBy === SearchSortBy.NAME) {
      resultsWithScores.sort((a, b) => {
        const nameDiff = a.product.title.localeCompare(b.product.title);
        return searchDto.sortOrder === "asc" ? nameDiff : -nameDiff;
      });
    } else {
      // DATE
      resultsWithScores.sort((a, b) => {
        const dateDiff =
          a.product.createdAt.getTime() - b.product.createdAt.getTime();
        return searchDto.sortOrder === "asc" ? dateDiff : -dateDiff;
      });
    }

    // Paginate
    const total = resultsWithScores.length;
    const paginatedResults = resultsWithScores.slice(offset, offset + limit);

    // Map to response DTO
    const searchResults: SearchResultDto[] = paginatedResults.map((item) => ({
      id: item.product.id,
      title: item.product.title,
      description: item.product.description,
      price: Number(item.product.price),
      relevanceScore: Number(item.relevanceScore.toFixed(4)),
      matchingSku: item.matchingSku,
    }));

    const pagination = generatePaginationMetadata(total, page, limit);

    return {
      results: searchResults,
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPreviousPage: pagination.hasPreviousPage,
      query: searchDto.query,
    };
  }

  /**
   * Get first image URL for multiple products
   * @param productIds - Array of product IDs
   * @returns Map of product ID to first image URL
   */
  private async getFirstImagesForProducts(
    productIds: string[],
  ): Promise<Map<string, string>> {
    if (productIds.length === 0) {
      return new Map();
    }

    // Fetch all product images (not variant images) for these products
    const allImages = await this.db
      .select({
        productId: productImages.productId,
        url: productImages.url,
        order: productImages.order,
      })
      .from(productImages)
      .where(
        and(
          inArray(productImages.productId, productIds),
          sql`${productImages.variantId} IS NULL`, // Only product images, not variant images
        ),
      )
      .orderBy(asc(productImages.order));

    // Group by productId and get the first image (lowest order) for each product
    const imageMap = new Map<string, string>();
    const processedProducts = new Set<string>();

    for (const image of allImages) {
      if (!processedProducts.has(image.productId)) {
        // Resolve S3 key to URL if needed
        let url = image.url;
        if (this.isS3Key(image.url)) {
          try {
            url = await this.storageService.getUrl(image.url);
          } catch {
            // If S3 key resolution fails, keep original
            url = image.url;
          }
        }
        imageMap.set(image.productId, url);
        processedProducts.add(image.productId);
      }
    }

    return imageMap;
  }

  /**
   * Enrich product with GST calculations
   * @param product - Product from database
   * @returns Product with GST calculations added
   */
  private enrichProductWithGst(product: typeof products.$inferSelect) {
    const pricingType = product.pricingType || "exclusive";

    let gstAmount: number;
    let priceExcludingGst: number;
    let priceIncludingGst: number;

    if (pricingType === "inclusive") {
      // Price already includes GST
      priceIncludingGst = product.price;
      priceExcludingGst = calculateBasePrice(product.price, product.gstRate);
      gstAmount = calculateGstFromInclusivePrice(
        product.price,
        product.gstRate,
      );
    } else {
      // Price excludes GST (default/exclusive)
      priceExcludingGst = product.price;
      priceIncludingGst = calculatePriceWithGst(product.price, product.gstRate);
      gstAmount = calculateGstAmount(product.price, product.gstRate);
    }

    return {
      ...product,
      gstAmount: Number(gstAmount.toFixed(2)),
      priceExcludingGst: Number(priceExcludingGst.toFixed(2)),
      priceIncludingGst: Number(priceIncludingGst.toFixed(2)),
      hsnCode: product.hsnCode || null,
    };
  }

  /**
   * Check if a URL is an S3 key (stored in our storage)
   * S3 keys typically start with a prefix like "products/", "avatars/", etc.
   */
  private isS3Key(url: string): boolean {
    // Check if it looks like a storage key (not a full URL)
    // Any string that doesn't start with http:// or https:// is considered a storage key
    // This includes both paths (with /) and plain filenames (without /)
    return (
      !url.startsWith("http://") &&
      !url.startsWith("https://") &&
      url.trim().length > 0 // Must be non-empty
    );
  }

  /**
   * Get product images with resolved URLs
   * Converts S3 keys to public URLs, keeps existing URLs as-is
   */
  async getProductImages(productId: string) {
    const images = await this.db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.order));

    // Resolve S3 keys to URLs
    const resolvedImages = await Promise.all(
      images.map(async (image) => {
        let url = image.url;
        if (this.isS3Key(image.url)) {
          try {
            url = await this.storageService.getUrl(image.url);
          } catch {
            // If S3 key resolution fails, keep original
            url = image.url;
          }
        }
        return {
          ...image,
          url,
        };
      }),
    );

    return resolvedImages;
  }

  /**
   * Get variant-specific images with resolved URLs
   * Converts S3 keys to public URLs, keeps existing URLs as-is
   */
  async getVariantImages(productId: string, variantId: string) {
    // Validate variant exists and belongs to product
    const [variant] = await this.db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.id, variantId),
          eq(productVariants.productId, productId),
        ),
      )
      .limit(1);

    if (!variant) {
      throw new NotFoundException(
        `Variant with ID ${variantId} not found for product ${productId}`,
      );
    }

    const images = await this.db
      .select()
      .from(productImages)
      .where(
        and(
          eq(productImages.productId, productId),
          eq(productImages.variantId, variantId),
        ),
      )
      .orderBy(asc(productImages.order));

    // Resolve S3 keys to URLs
    const resolvedImages = await Promise.all(
      images.map(async (image) => {
        let url = image.url;
        if (this.isS3Key(image.url)) {
          try {
            url = await this.storageService.getUrl(image.url);
          } catch {
            // If S3 key resolution fails, keep original
            url = image.url;
          }
        }
        return {
          ...image,
          url,
        };
      }),
    );

    return resolvedImages;
  }

  /**
   * Add an image to a product
   * @param productId - Product ID
   * @param imageKey - S3 key or URL
   * @param altText - Alt text for the image
   * @param order - Display order (auto-incremented if not provided)
   * @param variantId - Optional variant ID
   */
  async addProductImage(
    productId: string,
    imageKey: string,
    altText?: string,
    order?: number,
    variantId?: string,
  ) {
    const operation = async () => {
      // Validate product exists
      const [product] = await this.db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // Validate variant exists if provided
      if (variantId) {
        const [variant] = await this.db
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, variantId))
          .limit(1);

        if (!variant) {
          throw new NotFoundException(`Variant with ID ${variantId} not found`);
        }
      }

      // Lock images for this product/variant
      if (this.mediaTransactionService) {
        if (variantId) {
          await this.mediaTransactionService.lockVariantImages(
            productId,
            variantId,
          );
        } else {
          await this.mediaTransactionService.lockProductImages(productId);
        }
      }

      // Check existing image count and validate limits
      const existingImages = await this.db
        .select()
        .from(productImages)
        .where(
          variantId
            ? and(
                eq(productImages.productId, productId),
                eq(productImages.variantId, variantId),
              )
            : and(
                eq(productImages.productId, productId),
                sql`${productImages.variantId} IS NULL`,
              ),
        );

      const maxImages = variantId ? 10 : 15;
      if (existingImages.length >= maxImages) {
        throw new BadRequestException(
          `Maximum ${maxImages} image${maxImages > 1 ? "s" : ""} allowed per ${
            variantId ? "variant" : "product"
          }. Please delete an existing image first.`,
        );
      }

      // Auto-increment order if not provided
      let finalOrder = order;
      if (finalOrder === undefined) {
        const maxOrder = existingImages.reduce(
          (max, img) => Math.max(max, img.order),
          -1,
        );
        finalOrder = maxOrder + 1;
      }

      const [newImage] = await this.db
        .insert(productImages)
        .values({
          productId,
          variantId: variantId || null,
          url: imageKey, // Store S3 key or URL
          altText: altText || null,
          order: finalOrder,
        })
        .returning();

      // Resolve URL if it's an S3 key
      let url = imageKey;
      if (this.isS3Key(imageKey)) {
        try {
          url = await this.storageService.getUrl(imageKey);
        } catch {
          url = imageKey;
        }
      }

      return {
        ...newImage,
        url,
      };
    };

    const result = this.mediaTransactionService
      ? variantId
        ? await this.mediaTransactionService.withVariantImageLock(
            productId,
            variantId,
            operation,
          )
        : await this.mediaTransactionService.withProductImageLock(
            productId,
            operation,
          )
      : await operation();

    // Invalidate cache
    if (this.mediaCacheInvalidationService) {
      if (variantId) {
        await this.mediaCacheInvalidationService.invalidateVariantImages(
          productId,
          variantId,
        );
      } else {
        await this.mediaCacheInvalidationService.invalidateProductImages(
          productId,
        );
      }
    }

    return result;
  }

  /**
   * Delete a product image
   * Also deletes from S3 if it's an S3 key
   */
  async deleteProductImage(imageId: string) {
    const [image] = await this.db
      .select()
      .from(productImages)
      .where(eq(productImages.id, imageId))
      .limit(1);

    if (!image) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    // Delete from S3 if it's an S3 key
    if (this.isS3Key(image.url)) {
      try {
        await this.storageService.delete(image.url);
      } catch {
        // Continue even if S3 deletion fails
      }
    }

    // Delete from database
    await this.db.delete(productImages).where(eq(productImages.id, imageId));

    return { message: "Image deleted successfully" };
  }

  /**
   * Get collections for a product
   */
  async getProductCollections(productId: string) {
    // Check if product exists
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Get collections for this product
    const productCollectionsData = await this.db
      .select({
        id: collections.id,
        name: collections.name,
        slug: collections.slug,
        description: collections.description,
        imageUrl: collections.imageUrl,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      })
      .from(productCollections)
      .innerJoin(
        collections,
        eq(productCollections.collectionId, collections.id),
      )
      .where(eq(productCollections.productId, productId))
      .orderBy(collections.name);

    return productCollectionsData;
  }

  /**
   * Update product image order
   */
  async updateImageOrder(imageId: string, order: number) {
    const [image] = await this.db
      .select()
      .from(productImages)
      .where(eq(productImages.id, imageId))
      .limit(1);

    if (!image) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    const operation = async () => {
      // Lock images for this product/variant
      if (this.mediaTransactionService) {
        if (image.variantId) {
          await this.mediaTransactionService.lockVariantImages(
            image.productId,
            image.variantId,
          );
        } else {
          await this.mediaTransactionService.lockProductImages(image.productId);
        }
      }

      const [updated] = await this.db
        .update(productImages)
        .set({ order, updatedAt: new Date() })
        .where(eq(productImages.id, imageId))
        .returning();

      return updated;
    };

    const result = this.mediaTransactionService
      ? image.variantId
        ? await this.mediaTransactionService.withVariantImageLock(
            image.productId,
            image.variantId,
            operation,
          )
        : await this.mediaTransactionService.withProductImageLock(
            image.productId,
            operation,
          )
      : await operation();

    // Invalidate cache
    if (this.mediaCacheInvalidationService) {
      if (image.variantId) {
        await this.mediaCacheInvalidationService.invalidateVariantImages(
          image.productId,
          image.variantId,
        );
      } else {
        await this.mediaCacheInvalidationService.invalidateProductImages(
          image.productId,
        );
      }
    }

    return result;
  }

  /**
   * Update product image (alt text and/or order)
   */
  async updateImage(imageId: string, altText?: string, order?: number) {
    const [image] = await this.db
      .select()
      .from(productImages)
      .where(eq(productImages.id, imageId))
      .limit(1);

    if (!image) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    const updateData: {
      altText?: string | null;
      order?: number;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (altText !== undefined) {
      updateData.altText = altText || null;
    }

    if (order !== undefined) {
      updateData.order = order;
    }

    const [updated] = await this.db
      .update(productImages)
      .set(updateData)
      .where(eq(productImages.id, imageId))
      .returning();

    // Resolve URL if it's an S3 key
    let url = updated.url;
    if (this.isS3Key(updated.url)) {
      try {
        url = await this.storageService.getUrl(updated.url);
      } catch {
        url = updated.url;
      }
    }

    return {
      ...updated,
      url,
    };
  }

  /**
   * Replace a product image with a new one
   * Deletes the old S3 file and updates the URL
   */
  async replaceProductImage(imageId: string, newImageKey: string) {
    const [image] = await this.db
      .select()
      .from(productImages)
      .where(eq(productImages.id, imageId))
      .limit(1);

    if (!image) {
      throw new NotFoundException(`Image with ID ${imageId} not found`);
    }

    const operation = async () => {
      // Lock images for this product/variant
      if (this.mediaTransactionService) {
        if (image.variantId) {
          await this.mediaTransactionService.lockVariantImages(
            image.productId,
            image.variantId,
          );
        } else {
          await this.mediaTransactionService.lockProductImages(image.productId);
        }
      }

      // Delete old S3 file if it's an S3 key
      if (this.isS3Key(image.url)) {
        try {
          await this.storageService.delete(image.url);
        } catch {
          // Continue even if S3 deletion fails
        }
      }

      // Update image URL
      const [updated] = await this.db
        .update(productImages)
        .set({
          url: newImageKey,
          updatedAt: new Date(),
        })
        .where(eq(productImages.id, imageId))
        .returning();

      // Resolve URL if it's an S3 key
      let url = newImageKey;
      if (this.isS3Key(newImageKey)) {
        try {
          url = await this.storageService.getUrl(newImageKey);
        } catch {
          url = newImageKey;
        }
      }

      return {
        ...updated,
        url,
      };
    };

    const result = this.mediaTransactionService
      ? image.variantId
        ? await this.mediaTransactionService.withVariantImageLock(
            image.productId,
            image.variantId,
            operation,
          )
        : await this.mediaTransactionService.withProductImageLock(
            image.productId,
            operation,
          )
      : await operation();

    // Invalidate cache
    if (this.mediaCacheInvalidationService) {
      if (image.variantId) {
        await this.mediaCacheInvalidationService.invalidateVariantImages(
          image.productId,
          image.variantId,
        );
      } else {
        await this.mediaCacheInvalidationService.invalidateProductImages(
          image.productId,
        );
      }
    }

    return result;
  }

  /**
   * Create a global variant option type template
   */
  async createVariantOptionType(name: string, description?: string) {
    const [existing] = await this.db
      .select()
      .from(variantOptionTypes)
      .where(eq(variantOptionTypes.name, name))
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `Variant option type with name '${name}' already exists`,
      );
    }

    const [newOptionType] = await this.db
      .insert(variantOptionTypes)
      .values({
        name,
        description: description || null,
      })
      .returning();

    return newOptionType;
  }

  /**
   * Get all global variant option type templates
   */
  async getVariantOptionTypes() {
    return this.db
      .select()
      .from(variantOptionTypes)
      .orderBy(asc(variantOptionTypes.name));
  }

  /**
   * Add a variant option type to a product
   */
  async addVariantOptionTypeToProduct(
    productId: string,
    optionTypeId: string | undefined,
    name: string,
    displayOrder?: number,
  ) {
    // Validate product exists
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Validate option type template exists if provided
    if (optionTypeId) {
      const [optionType] = await this.db
        .select()
        .from(variantOptionTypes)
        .where(eq(variantOptionTypes.id, optionTypeId))
        .limit(1);

      if (!optionType) {
        throw new NotFoundException(
          `Variant option type with ID ${optionTypeId} not found`,
        );
      }
    }

    // Check if product already has an option type with this name
    const [existing] = await this.db
      .select()
      .from(productVariantOptionTypes)
      .where(
        and(
          eq(productVariantOptionTypes.productId, productId),
          eq(productVariantOptionTypes.name, name),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `Product already has a variant option type named '${name}'`,
      );
    }

    // Get max display order for this product
    const existingOptionTypes = await this.db
      .select()
      .from(productVariantOptionTypes)
      .where(eq(productVariantOptionTypes.productId, productId));

    const maxDisplayOrder =
      existingOptionTypes.length > 0
        ? Math.max(...existingOptionTypes.map((ot) => ot.displayOrder))
        : -1;

    const [newProductOptionType] = await this.db
      .insert(productVariantOptionTypes)
      .values({
        productId,
        optionTypeId: optionTypeId || null,
        name,
        displayOrder: displayOrder ?? maxDisplayOrder + 1,
      })
      .returning();

    return newProductOptionType;
  }

  /**
   * Add a value to a product variant option type
   */
  async addValueToVariantOptionType(
    productVariantOptionTypeId: string,
    value: string,
    displayOrder?: number,
  ) {
    // Validate option type exists
    const [optionType] = await this.db
      .select()
      .from(productVariantOptionTypes)
      .where(eq(productVariantOptionTypes.id, productVariantOptionTypeId))
      .limit(1);

    if (!optionType) {
      throw new NotFoundException(
        `Product variant option type with ID ${productVariantOptionTypeId} not found`,
      );
    }

    // Check if value already exists for this option type
    const [existing] = await this.db
      .select()
      .from(variantOptionValues)
      .where(
        and(
          eq(
            variantOptionValues.productVariantOptionTypeId,
            productVariantOptionTypeId,
          ),
          eq(variantOptionValues.value, value),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        `Value '${value}' already exists for this option type`,
      );
    }

    // Get max display order for this option type
    const existingValues = await this.db
      .select()
      .from(variantOptionValues)
      .where(
        eq(
          variantOptionValues.productVariantOptionTypeId,
          productVariantOptionTypeId,
        ),
      );

    const maxDisplayOrder =
      existingValues.length > 0
        ? Math.max(...existingValues.map((v) => v.displayOrder))
        : -1;

    const [newValue] = await this.db
      .insert(variantOptionValues)
      .values({
        productVariantOptionTypeId,
        value,
        displayOrder: displayOrder ?? maxDisplayOrder + 1,
      })
      .returning();

    return newValue;
  }

  /**
   * Get variant option types for a product
   */
  async getProductVariantOptionTypes(productId: string) {
    // Validate product exists
    const [product] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // Get option types with their values
    const optionTypes = await this.db
      .select()
      .from(productVariantOptionTypes)
      .where(eq(productVariantOptionTypes.productId, productId))
      .orderBy(asc(productVariantOptionTypes.displayOrder));

    // Get values for each option type
    const optionTypesWithValues = await Promise.all(
      optionTypes.map(async (optionType) => {
        const values = await this.db
          .select()
          .from(variantOptionValues)
          .where(
            eq(variantOptionValues.productVariantOptionTypeId, optionType.id),
          )
          .orderBy(asc(variantOptionValues.displayOrder));

        return {
          ...optionType,
          values,
        };
      }),
    );

    return optionTypesWithValues;
  }

  /**
   * Remove a variant option type from a product
   */
  async removeVariantOptionTypeFromProduct(
    productId: string,
    productVariantOptionTypeId: string,
  ) {
    // Validate option type belongs to product
    const [optionType] = await this.db
      .select()
      .from(productVariantOptionTypes)
      .where(
        and(
          eq(productVariantOptionTypes.id, productVariantOptionTypeId),
          eq(productVariantOptionTypes.productId, productId),
        ),
      )
      .limit(1);

    if (!optionType) {
      throw new NotFoundException(
        `Product variant option type with ID ${productVariantOptionTypeId} not found for product ${productId}`,
      );
    }

    // Delete will cascade to values and assignments
    await this.db
      .delete(productVariantOptionTypes)
      .where(eq(productVariantOptionTypes.id, productVariantOptionTypeId));

    return { success: true };
  }

  /**
   * Remove a value from a variant option type
   */
  async removeValueFromVariantOptionType(
    productVariantOptionTypeId: string,
    valueId: string,
  ) {
    // Validate value belongs to option type
    const [value] = await this.db
      .select()
      .from(variantOptionValues)
      .where(
        and(
          eq(variantOptionValues.id, valueId),
          eq(
            variantOptionValues.productVariantOptionTypeId,
            productVariantOptionTypeId,
          ),
        ),
      )
      .limit(1);

    if (!value) {
      throw new NotFoundException(
        `Variant option value with ID ${valueId} not found for option type ${productVariantOptionTypeId}`,
      );
    }

    // Delete will cascade to assignments
    await this.db
      .delete(variantOptionValues)
      .where(eq(variantOptionValues.id, valueId));

    return { success: true };
  }

  /**
   * Get product recommendations based on the current product
   * Returns products from the same category, excluding the current product
   */
  async getRecommendations(productId: string): Promise<ProductResponseDto[]> {
    // Get the current product
    const [product] = await this.db
      .select({
        id: products.id,
        categoryId: products.categoryId,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    // If product has no category, return empty array
    if (!product.categoryId) {
      return [];
    }

    // Get up to 8 products from the same category, excluding the current product
    const recommendedProducts = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.categoryId, product.categoryId),
          eq(products.status, "active"),
          sql`${products.id} != ${productId}`,
        ),
      )
      .orderBy(desc(products.createdAt))
      .limit(8);

    // Get first images for recommended products
    const productIds = recommendedProducts.map((p) => p.id);
    const firstImages = await this.getFirstImagesForProducts(productIds);

    // Convert to ProductResponseDto format
    return recommendedProducts.map((p) => ({
      ...this.enrichProductWithGst(p),
      thumbnailUrl: firstImages.get(p.id) || null,
    }));
  }
}
