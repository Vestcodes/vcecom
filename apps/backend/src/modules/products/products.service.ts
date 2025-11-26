import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  categories,
  db,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  notInArray,
  or,
  products,
  productVariants,
  sql,
} from "@vcecom/db";
import {
  calculateGstAmount,
  calculatePriceWithGst,
  isValidGstRate,
} from "../../common/utils/gst.utils";
import { CreateProductDto } from "./dto/create-product.dto";
import { QueryProductsDto } from "./dto/query-products.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class ProductsService {
  /**
   * Create a new product
   */
  async create(createProductDto: CreateProductDto) {
    // Validate category exists if provided
    if (createProductDto.categoryId) {
      const [category] = await db
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

    // Create product
    const [newProduct] = await db
      .insert(products)
      .values({
        title: createProductDto.title,
        description: createProductDto.description || null,
        price: createProductDto.price,
        gstRate,
        hsnCode: createProductDto.hsnCode || null,
        status: createProductDto.status || "draft",
        categoryId: createProductDto.categoryId || null,
      })
      .returning();

    return this.enrichProductWithGst(newProduct);
  }

  /**
   * Get all products with pagination, search, and filters
   */
  async findAll(query: QueryProductsDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

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
        const variantsWithMatchingSku = await db
          .select({ productId: productVariants.productId })
          .from(productVariants)
          .where(ilike(productVariants.sku, searchPattern));

        if (variantsWithMatchingSku.length > 0) {
          const productIds = variantsWithMatchingSku.map((v) => v.productId);
          searchConditions.push(
            sql`${products.id} = ANY(${sql.raw(`ARRAY[${productIds.map(() => "?").join(",")}]`)})` as any,
          );
        }
      }

      conditions.push(or(...searchConditions) as any);
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
      const productsInStock = await db
        .selectDistinct({ productId: productVariants.productId })
        .from(productVariants)
        .where(sql`${productVariants.inventory} > 0`);

      const productIdsInStock = productsInStock.map((p) => p.productId);

      if (query.inStock) {
        // Filter to only products in stock
        if (productIdsInStock.length > 0) {
          const inStockConditions = productIdsInStock.map((id) =>
            eq(products.id, id),
          );
          conditions.push(or(...inStockConditions) as any);
        } else {
          // No products in stock, return empty result
          return {
            data: [],
            total: 0,
            page,
            limit,
            totalPages: 0,
          };
        }
      } else {
        // Filter to only products out of stock (not in the in-stock list)
        if (productIdsInStock.length > 0) {
          // Products that are NOT in the in-stock list
          const notInStockConditions = productIdsInStock.map(
            (id) => sql`${products.id} != ${id}` as any,
          );
          conditions.push(and(...notInStockConditions) as any);
        }
        // If no products are in stock, all products are out of stock, so no additional filter needed
      }
    }

    // Build final where condition
    let whereCondition: ReturnType<typeof and> | undefined;
    if (conditions.length > 0) {
      whereCondition = and(...conditions) as ReturnType<typeof and>;
    }

    // Get total count
    const countQuery = db.select().from(products);
    if (whereCondition) {
      countQuery.where(whereCondition);
    }
    const allProductsForCount = await countQuery;
    const total = allProductsForCount.length;

    // Build sort order
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sortOrder || "desc";
    let orderBy;
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
    const productsQuery = db.select().from(products);
    if (whereCondition) {
      productsQuery.where(whereCondition);
    }
    const allProducts = await productsQuery
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy);

    const totalPages = Math.ceil(total / limit);

    return {
      data: allProducts,
      total: Number(total),
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get product by ID
   */
  async findOne(id: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.enrichProductWithGst(product);
  }

  /**
   * Update a product
   */
  async update(id: string, updateProductDto: UpdateProductDto) {
    // Check if product exists
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Validate category exists if provided
    if (updateProductDto.categoryId) {
      const [category] = await db
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
    if (updateProductDto.status !== undefined)
      updateData.status = updateProductDto.status;
    if (updateProductDto.categoryId !== undefined)
      updateData.categoryId = updateProductDto.categoryId || null;

    // Update product
    const [updated] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete a product
   */
  async remove(id: string) {
    // Check if product exists
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Delete product (variants and images will be cascade deleted)
    await db.delete(products).where(eq(products.id, id));

    return { message: "Product deleted successfully" };
  }

  /**
   * Enrich product with GST calculations
   * @param product - Product from database
   * @returns Product with GST calculations added
   */
  private enrichProductWithGst(product: typeof products.$inferSelect) {
    const gstAmount = calculateGstAmount(product.price, product.gstRate);
    const priceIncludingGst = calculatePriceWithGst(
      product.price,
      product.gstRate,
    );

    return {
      ...product,
      gstAmount: Number(gstAmount.toFixed(2)),
      priceExcludingGst: Number(product.price.toFixed(2)),
      priceIncludingGst: Number(priceIncludingGst.toFixed(2)),
    };
  }
}
