import { eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeTestDb, createTestDb } from "../test-utils/db";
import { categories } from "./categories";

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "";

describe("Categories Schema", () => {
  const { db, pool } = createTestDb(TEST_DB_URL);

  beforeEach(async () => {
    await db.delete(categories);
  });

  afterEach(async () => {
    await db.delete(categories);
    await closeTestDb(pool);
  });

  describe("Basic CRUD Operations", () => {
    it("should create a category with valid data", async () => {
      const [category] = await db
        .insert(categories)
        .values({
          name: "Electronics",
          slug: "electronics",
          description: "Electronic products",
        })
        .returning();

      expect(category).toBeDefined();
      expect(category.name).toBe("Electronics");
      expect(category.slug).toBe("electronics");
      expect(category.description).toBe("Electronic products");
      expect(category.id).toBeDefined();
      expect(category.parentId).toBeNull();
      expect(category.createdAt).toBeInstanceOf(Date);
      expect(category.updatedAt).toBeInstanceOf(Date);
    });

    it("should read a category by id", async () => {
      const [inserted] = await db
        .insert(categories)
        .values({
          name: "Books",
          slug: "books",
        })
        .returning();

      const [found] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, inserted.id));

      expect(found).toBeDefined();
      expect(found?.name).toBe("Books");
      expect(found?.slug).toBe("books");
    });

    it("should update a category", async () => {
      const [inserted] = await db
        .insert(categories)
        .values({
          name: "Old Name",
          slug: "old-slug",
        })
        .returning();

      const [updated] = await db
        .update(categories)
        .set({ name: "New Name", description: "Updated description" })
        .where(eq(categories.id, inserted.id))
        .returning();

      expect(updated?.name).toBe("New Name");
      expect(updated?.description).toBe("Updated description");
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });

    it("should delete a category", async () => {
      const [inserted] = await db
        .insert(categories)
        .values({
          name: "To Delete",
          slug: "to-delete",
        })
        .returning();

      await db.delete(categories).where(eq(categories.id, inserted.id));

      const [found] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, inserted.id));

      expect(found).toBeUndefined();
    });
  });

  describe("Slug Uniqueness", () => {
    it("should enforce unique slug constraint", async () => {
      await db.insert(categories).values({
        name: "Category 1",
        slug: "unique-slug",
      });

      await expect(
        db.insert(categories).values({
          name: "Category 2",
          slug: "unique-slug",
        }),
      ).rejects.toThrow();
    });

    it("should allow different slugs", async () => {
      await db.insert(categories).values({
        name: "Category 1",
        slug: "slug-1",
      });

      const [category2] = await db
        .insert(categories)
        .values({
          name: "Category 2",
          slug: "slug-2",
        })
        .returning();

      expect(category2).toBeDefined();
      expect(category2.slug).toBe("slug-2");
    });
  });

  describe("Hierarchical Categories", () => {
    it("should create a parent category", async () => {
      const [parent] = await db
        .insert(categories)
        .values({
          name: "Parent Category",
          slug: "parent",
        })
        .returning();

      expect(parent.parentId).toBeNull();
    });

    it("should create a child category with parent_id", async () => {
      const [parent] = await db
        .insert(categories)
        .values({
          name: "Parent",
          slug: "parent",
        })
        .returning();

      const [child] = await db
        .insert(categories)
        .values({
          name: "Child",
          slug: "child",
          parentId: parent.id,
        })
        .returning();

      expect(child.parentId).toBe(parent.id);
    });

    it("should allow multiple children for same parent", async () => {
      const [parent] = await db
        .insert(categories)
        .values({
          name: "Parent",
          slug: "parent",
        })
        .returning();

      const [child1] = await db
        .insert(categories)
        .values({
          name: "Child 1",
          slug: "child-1",
          parentId: parent.id,
        })
        .returning();

      const [child2] = await db
        .insert(categories)
        .values({
          name: "Child 2",
          slug: "child-2",
          parentId: parent.id,
        })
        .returning();

      expect(child1.parentId).toBe(parent.id);
      expect(child2.parentId).toBe(parent.id);
    });

    it("should create nested categories (grandchild)", async () => {
      const [parent] = await db
        .insert(categories)
        .values({
          name: "Parent",
          slug: "parent",
        })
        .returning();

      const [child] = await db
        .insert(categories)
        .values({
          name: "Child",
          slug: "child",
          parentId: parent.id,
        })
        .returning();

      const [grandchild] = await db
        .insert(categories)
        .values({
          name: "Grandchild",
          slug: "grandchild",
          parentId: child.id,
        })
        .returning();

      expect(grandchild.parentId).toBe(child.id);
    });
  });

  describe("Optional Fields", () => {
    it("should allow null description", async () => {
      const [category] = await db
        .insert(categories)
        .values({
          name: "Category",
          slug: "category",
        })
        .returning();

      expect(category.description).toBeNull();
    });

    it("should allow null image_url", async () => {
      const [category] = await db
        .insert(categories)
        .values({
          name: "Category",
          slug: "category",
        })
        .returning();

      expect(category.imageUrl).toBeNull();
    });

    it("should store description when provided", async () => {
      const [category] = await db
        .insert(categories)
        .values({
          name: "Category",
          slug: "category",
          description: "Test description",
        })
        .returning();

      expect(category.description).toBe("Test description");
    });

    it("should store image_url when provided", async () => {
      const [category] = await db
        .insert(categories)
        .values({
          name: "Category",
          slug: "category",
          imageUrl: "https://example.com/image.jpg",
        })
        .returning();

      expect(category.imageUrl).toBe("https://example.com/image.jpg");
    });
  });

  describe("Query Operations", () => {
    it("should find categories by slug", async () => {
      await db.insert(categories).values({
        name: "Category 1",
        slug: "category-1",
      });

      await db.insert(categories).values({
        name: "Category 2",
        slug: "category-2",
      });

      const [found] = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, "category-1"));

      expect(found).toBeDefined();
      expect(found?.name).toBe("Category 1");
    });

    it("should find root categories (no parent)", async () => {
      const [parent] = await db
        .insert(categories)
        .values({
          name: "Parent",
          slug: "parent",
        })
        .returning();

      await db.insert(categories).values({
        name: "Child",
        slug: "child",
        parentId: parent.id,
      });

      const rootCategories = await db
        .select()
        .from(categories)
        .where(isNull(categories.parentId));

      expect(rootCategories.length).toBeGreaterThan(0);
      expect(rootCategories.every((c) => c.parentId === null)).toBe(true);
    });

    it("should find child categories by parent_id", async () => {
      const [parent] = await db
        .insert(categories)
        .values({
          name: "Parent",
          slug: "parent",
        })
        .returning();

      await db.insert(categories).values({
        name: "Child 1",
        slug: "child-1",
        parentId: parent.id,
      });

      await db.insert(categories).values({
        name: "Child 2",
        slug: "child-2",
        parentId: parent.id,
      });

      const children = await db
        .select()
        .from(categories)
        .where(eq(categories.parentId, parent.id));

      expect(children.length).toBe(2);
      expect(children.every((c) => c.parentId === parent.id)).toBe(true);
    });
  });

  describe("Timestamps", () => {
    it("should set createdAt and updatedAt on creation", async () => {
      const [category] = await db
        .insert(categories)
        .values({
          name: "Category",
          slug: "category",
        })
        .returning();

      expect(category.createdAt).toBeInstanceOf(Date);
      expect(category.updatedAt).toBeInstanceOf(Date);
      expect(category.createdAt.getTime()).toBeGreaterThan(0);
      expect(category.updatedAt.getTime()).toBeGreaterThan(0);
    });

    it("should update updatedAt on modification", async () => {
      const [inserted] = await db
        .insert(categories)
        .values({
          name: "Category",
          slug: "category",
        })
        .returning();

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const [updated] = await db
        .update(categories)
        .set({ name: "Updated Category" })
        .where(eq(categories.id, inserted.id))
        .returning();

      expect(updated?.updatedAt.getTime()).toBeGreaterThan(
        inserted.updatedAt.getTime(),
      );
    });
  });
});
