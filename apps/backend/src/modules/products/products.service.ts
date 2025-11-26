import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { categories, db, eq, products, sql } from "@vcecom/db";
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

    // Create product
    const [newProduct] = await db
      .insert(products)
      .values({
        title: createProductDto.title,
        description: createProductDto.description || null,
        price: createProductDto.price,
        gstRate: createProductDto.gstRate ?? 0,
        status: createProductDto.status || "draft",
        categoryId: createProductDto.categoryId || null,
      })
      .returning();

    return newProduct;
  }

  /**
   * Get all products with pagination and filters
   */
  async findAll(query: QueryProductsDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (query.status) {
      conditions.push(eq(products.status, query.status));
    }
    if (query.categoryId) {
      conditions.push(eq(products.categoryId, query.categoryId));
    }

    // Get total count
    const countQuery = db.select().from(products);
    if (conditions.length > 0) {
      countQuery.where(and(...conditions));
    }
    const allProductsForCount = await countQuery;
    const total = allProductsForCount.length;

    // Get products
    const productsQuery = db.select().from(products);
    if (conditions.length > 0) {
      productsQuery.where(and(...conditions));
    }
    const allProducts = await productsQuery
      .limit(limit)
      .offset(offset)
      .orderBy(products.createdAt);

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

    return product;
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
}
