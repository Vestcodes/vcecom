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
  lte,
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

  The provided ProductsService implements basic CRUD (Create, Read, Update, Delete) operations with pagination, filtering, and sorting. The search functionality, however, is implemented using inefficient ilike (Drizzle's equivalent of LIKE with wildcards) for title, description, and SKU, which can lead to performance issues on large datasets.

To satisfy the original task's requirement for a performant search with ranking and to better leverage your PostgreSQL database, we need to replace the ilike search logic with PostgreSQL's Full-Text Search (FTS) functionality.

Here are the necessary changes to the findAll method in ProductsService.ts:

⚙️ Proposed Changes to findAll Method
1. Update Imports
You need sql from @vcecom/db and will remove the dependency on dynamically importing inArray and notInArray.

2. Full-Text Search (FTS) Logic
We will modify the search block to use the ts_rank and to_tsquery PostgreSQL functions for proper ranking and performance. This assumes you have already created a tsvector column (e.g., search_vector) and a GIN index on it in your Drizzle schema, as recommended in the previous plan.

Key Improvements:

Ranking: Uses ts_rank to assign a relevance score.

Performance: Utilizes the fast GIN index on the tsvector column.

Combined Search: The search query is applied to:

The FTS index (for title/description).

The product variants' SKU.

Updated findAll Method
TypeScript

// apps/backend/src/modules/products/products.service.ts

// ... existing imports

@Injectable()
export class ProductsService {
  // ... existing methods (create, findOne, update, remove, enrichProductWithGst)

  /**
   * Get all products with pagination, search, and filters
   */
  async findAll(query: QueryProductsDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<
      | typeof eq
      | typeof and
      | typeof or
      | typeof gte
      | typeof lte
      | typeof ilike
    >[] = [];

    let tsQuery: ReturnType<typeof sql> | undefined;

    // --- START: Full-Text Search (FTS) and SKU Logic with Fixes ---
    if (query.search) {
      // FIX 1: Use plainto_tsquery for safer, more user-friendly search parsing
      tsQuery = sql`plainto_tsquery('english', ${query.search})`;

      // FIX 2: Define and reuse the tsvector expression to reduce duplication
      const tsVectorExpression = sql`to_tsvector('english', ${products.title} || ' ' || coalesce(${products.description}, ''))`;

      const searchConditions = [
        // A. FTS Match: Uses the index created via raw SQL
        sql`${tsVectorExpression} @@ ${tsQuery}`,

        // B. SKU Match: Checks if any variant SKU contains the search term
        sql`EXISTS (
          SELECT 1 FROM ${productVariants} pv
          WHERE pv.product_id = ${products.id} AND pv.sku ILIKE ${`%${query.search}%`}
        )`,
      ];

      // Combine conditions: products matching FTS OR SKU
      conditions.push(or(...searchConditions));
    }
    // --- END: Full-Text Search (FTS) and SKU Logic with Fixes ---

    // Status filter
    if (query.status) {
      conditions.push(eq(products.status, query.status));
    }
    // ... (Category, Price Range, and In Stock filters remain here)

    // Build final where condition
    let whereCondition: ReturnType<typeof and> | undefined;
    if (conditions.length > 0) {
      whereCondition = and(...conditions);
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereCondition);
    const total = totalResult.count || 0;

    // --- START: Build Sort Order with Ranking ---
    const sortBy = query.sortBy || "date";
    const sortOrder = query.sortOrder || "desc";
    const orderByClauses: ReturnType<typeof asc | typeof desc | typeof sql>[] =
      [];

    // 1. RANKING: If searching, rank by relevance first (ts_rank calculation)
    if (tsQuery) {
      // Reuse tsVectorExpression for rank calculation
      const tsRank = sql`ts_rank(${tsVectorExpression}, ${tsQuery})`;
      orderByClauses.push(sql`${tsRank} DESC`);
    }

    // 2. SECONDARY SORT: Apply user-specified sort
    if (sortBy === "price") {
      orderByClauses.push(
        sortOrder === "asc" ? asc(products.price) : desc(products.price),
      );
    } else if (sortBy === "name") {
      orderByClauses.push(
        sortOrder === "asc" ? asc(products.title) : desc(products.title),
      );
    } else {
      // date (default)
      orderByClauses.push(
        sortOrder === "asc"
          ? asc(products.createdAt)
          : desc(products.createdAt),
      );
    }
    // --- END: Build Sort Order with Ranking ---

    // Get products
    const allProducts = await db
      .select()
      .from(products)
      .where(whereCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(...orderByClauses);

    const totalPages = Math.ceil(total / limit);

    return {
      data: allProducts.map((product) => this.enrichProductWithGst(product)),
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

    return this.enrichProductWithGst(updated);
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
      hsnCode: product.hsnCode || null,
    };
  }
}
