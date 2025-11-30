// packages/db/src/schema/products.ts

import { sql } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "archived",
]);

export const products = pgTable(
  "products",
  (_table) => ({
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    price: real("price").notNull(),
    gstRate: real("gst_rate").notNull().default(0),
    hsnCode: text("hsn_code"),
    status: productStatusEnum("status").notNull().default("draft"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),

    // 📢 OMITTING searchVector column definition entirely for this workaround

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  }),
  (table) => ({
    categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
    statusIdx: index("products_status_idx").on(table.status),
    hsnCodeIdx: index("products_hsn_code_idx").on(table.hsnCode),

    // ✅ FTS FIX: Define the GIN index using raw SQL for the FTS vector generation
    searchIndex: index("products_search_idx").using(
      "gin",
      // Create the tsvector from title and description columns directly in the index definition
      sql`to_tsvector('english', ${table.title} || ' ' || coalesce(${table.description}, ''))`,
    ),
  }),
);
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
