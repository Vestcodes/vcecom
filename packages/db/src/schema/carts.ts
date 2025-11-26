import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { cartItems } from "./cart-items";
import { customers } from "./customers";

export const carts = pgTable(
  "carts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "cascade",
    }),
    sessionId: text("session_id").unique(),
    subtotal: real("subtotal").notNull().default(0),
    gstAmount: real("gst_amount").notNull().default(0),
    total: real("total").notNull().default(0),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdIdx: index("carts_customer_id_idx").on(table.customerId),
    sessionIdIdx: index("carts_session_id_idx").on(table.sessionId),
  }),
);

export const cartsRelations = relations(carts, ({ one, many }) => ({
  customer: one(customers, {
    fields: [carts.customerId],
    references: [customers.id],
  }),
  items: many(cartItems),
}));

export type Cart = typeof carts.$inferSelect;
export type NewCart = typeof carts.$inferInsert;
