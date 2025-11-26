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
import { addresses } from "./addresses";
import { customers } from "./customers";
import { orderItems } from "./order-items";

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    orderNumber: text("order_number").notNull().unique(),
    status: orderStatusEnum("status").notNull().default("pending"),
    subtotal: real("subtotal").notNull().default(0),
    gstAmount: real("gst_amount").notNull().default(0),
    shippingCost: real("shipping_cost").notNull().default(0),
    total: real("total").notNull().default(0),
    razorpayOrderId: text("razorpay_order_id").unique(),
    shippingProvider: text("shipping_provider"),
    shippingAddressId: uuid("shipping_address_id")
      .notNull()
      .references(() => addresses.id, { onDelete: "restrict" }),
    billingAddressId: uuid("billing_address_id")
      .notNull()
      .references(() => addresses.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdIdx: index("orders_customer_id_idx").on(table.customerId),
    orderNumberIdx: index("orders_order_number_idx").on(table.orderNumber),
    statusIdx: index("orders_status_idx").on(table.status),
    razorpayOrderIdIdx: index("orders_razorpay_order_id_idx").on(
      table.razorpayOrderId,
    ),
    shippingAddressIdIdx: index("orders_shipping_address_id_idx").on(
      table.shippingAddressId,
    ),
    billingAddressIdIdx: index("orders_billing_address_id_idx").on(
      table.billingAddressId,
    ),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
  shippingAddress: one(addresses, {
    fields: [orders.shippingAddressId],
    references: [addresses.id],
    relationName: "shippingAddress",
  }),
  billingAddress: one(addresses, {
    fields: [orders.billingAddressId],
    references: [addresses.id],
    relationName: "billingAddress",
  }),
  items: many(orderItems),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
