import { relations } from "drizzle-orm";
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
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    price: real("price").notNull(),
    gstRate: real("gst_rate").notNull().default(0),
    status: productStatusEnum("status").notNull().default("draft"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdIdx: index("products_category_id_idx").on(table.categoryId),
    statusIdx: index("products_status_idx").on(table.status),
    hsnCodeIdx: index("products_hsn_code_idx").on(table.hsnCode),
  }),
);

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
