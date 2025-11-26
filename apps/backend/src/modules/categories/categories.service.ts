import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { categories, db, eq } from "@vcecom/db";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Injectable()
export class CategoriesService {
  /**
   * Generate a slug from a name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }

  /**
   * Ensure slug is unique by appending a number if needed
   */
  private async ensureUniqueSlug(
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const [existing] = await db
        .select()
        .from(categories)
        .where(
          excludeId ? eq(categories.slug, slug) : eq(categories.slug, slug),
        )
        .limit(1);

      if (!existing || existing.id === excludeId) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Create a new category
   */
  async create(createCategoryDto: CreateCategoryDto) {
    // Validate parent exists if provided
    if (createCategoryDto.parentId) {
      const [parent] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, createCategoryDto.parentId))
        .limit(1);

      if (!parent) {
        throw new BadRequestException(
          `Parent category with ID ${createCategoryDto.parentId} not found`,
        );
      }
    }

    // Generate slug if not provided
    const slug = createCategoryDto.slug
      ? await this.ensureUniqueSlug(createCategoryDto.slug)
      : await this.ensureUniqueSlug(this.generateSlug(createCategoryDto.name));

    // Create category
    const [newCategory] = await db
      .insert(categories)
      .values({
        name: createCategoryDto.name,
        slug,
        parentId: createCategoryDto.parentId || null,
        description: createCategoryDto.description || null,
        imageUrl: createCategoryDto.imageUrl || null,
      })
      .returning();

    return newCategory;
  }

  /**
   * Get all categories
   */
  async findAll() {
    return db.select().from(categories);
  }

  /**
   * Get category tree (hierarchical structure)
   */
  async findTree() {
    const allCategories = await db.select().from(categories);

    // Build a map of categories by ID
    const categoryMap = new Map(
      allCategories.map((cat) => [cat.id, { ...cat, children: [] }]),
    );

    // Build tree structure
    const rootCategories: typeof allCategories = [];

    for (const category of allCategories) {
      const categoryWithChildren = categoryMap.get(category.id)!;

      if (category.parentId) {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        } else {
          // Parent not found, treat as root
          rootCategories.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    }

    return rootCategories;
  }

  /**
   * Get category by ID
   */
  async findOne(id: string) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  /**
   * Get category by slug
   */
  async findBySlug(slug: string) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!category) {
      throw new NotFoundException(`Category with slug '${slug}' not found`);
    }

    return category;
  }

  /**
   * Update a category
   */
  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    // Check if category exists
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Validate parent exists if provided
    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException("Category cannot be its own parent");
      }

      const [parent] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, updateCategoryDto.parentId))
        .limit(1);

      if (!parent) {
        throw new BadRequestException(
          `Parent category with ID ${updateCategoryDto.parentId} not found`,
        );
      }

      // Check for circular reference (parent cannot be a descendant)
      const descendants = await this.getDescendants(id);
      if (descendants.some((d) => d.id === updateCategoryDto.parentId)) {
        throw new BadRequestException(
          "Cannot set parent: would create circular reference",
        );
      }
    }

    // Generate slug if name changed and slug not provided
    let slug = updateCategoryDto.slug;
    if (updateCategoryDto.name && !slug) {
      slug = await this.ensureUniqueSlug(
        this.generateSlug(updateCategoryDto.name),
        id,
      );
    } else if (slug) {
      slug = await this.ensureUniqueSlug(slug, id);
    }

    // Update category
    const updateData: Partial<typeof categories.$inferInsert> = {};
    if (updateCategoryDto.name !== undefined)
      updateData.name = updateCategoryDto.name;
    if (slug !== undefined) updateData.slug = slug;
    if (updateCategoryDto.parentId !== undefined)
      updateData.parentId = updateCategoryDto.parentId || null;
    if (updateCategoryDto.description !== undefined)
      updateData.description = updateCategoryDto.description || null;
    if (updateCategoryDto.imageUrl !== undefined)
      updateData.imageUrl = updateCategoryDto.imageUrl || null;

    const [updated] = await db
      .update(categories)
      .set(updateData)
      .where(eq(categories.id, id))
      .returning();

    return updated;
  }

  /**
   * Delete a category
   */
  async remove(id: string) {
    // Check if category exists
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check if category has children
    const [child] = await db
      .select()
      .from(categories)
      .where(eq(categories.parentId, id))
      .limit(1);

    if (child) {
      throw new BadRequestException(
        "Cannot delete category with child categories. Please delete or reassign children first.",
      );
    }

    // Delete category
    await db.delete(categories).where(eq(categories.id, id));

    return { message: "Category deleted successfully" };
  }

  /**
   * Get all descendants of a category (for circular reference check)
   */
  private async getDescendants(
    categoryId: string,
  ): Promise<(typeof categories.$inferSelect)[]> {
    const descendants: (typeof categories.$inferSelect)[] = [];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await db
        .select()
        .from(categories)
        .where(eq(categories.parentId, currentId));

      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }

    return descendants;
  }
}
