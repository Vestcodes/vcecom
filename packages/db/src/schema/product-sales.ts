import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";

/**
 * Sale status enum
 * - scheduled: Future sale (startDate in future)
 * - active: Currently active sale
 * - expired: Past sale (endDate passed)
 * - disabled: Manually disabled sale
 */
export const saleStatusEnum = pgEnum("sale_status", [
  "scheduled",
  "active",
  "expired",
  "disabled",
]);

/**
 * Product sales table
 * Stores sale prices for products with optional date ranges
 * - If startDate and endDate are null, sale is always active
 * - Priority determines which sale applies if multiple exist
 */
export const productSales = pgTable(
  "product_sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    // Sale price (absolute price, must be less than product's regular price)
    salePrice: real("sale_price").notNull(),

    // Date range (null = always active)
    startDate: timestamp("start_date"),
    endDate: timestamp("end_date"),

    // Status tracking
    status: saleStatusEnum("status").notNull().default("scheduled"),
    isActive: boolean("is_active").notNull().default(true),

    // Metadata
    name: text("name"), // e.g., "Summer Sale 2025"
    description: text("description"),

    // Priority (if multiple sales exist, highest priority wins)
    priority: integer("priority").notNull().default(0),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    productIdIdx: index("product_sales_product_id_idx").on(table.productId),
    statusIdx: index("product_sales_status_idx").on(table.status),
    isActiveIdx: index("product_sales_is_active_idx").on(table.isActive),
    dateRangeIdx: index("product_sales_date_range_idx").on(
      table.startDate,
      table.endDate,
    ),
    // Composite index for active sales lookup
    activeSaleIdx: index("product_sales_active_idx").on(
      table.productId,
      table.isActive,
      table.status,
    ),
  }),
);

export const productSalesRelations = relations(productSales, ({ one }) => ({
  product: one(products, {
    fields: [productSales.productId],
    references: [products.id],
  }),
}));

export type ProductSale = typeof productSales.$inferSelect;
export type NewProductSale = typeof productSales.$inferInsert;
