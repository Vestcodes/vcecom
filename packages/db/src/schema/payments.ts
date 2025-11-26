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
import { orders } from "./orders";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "processing",
  "captured",
  "failed",
  "refunded",
  "partially_refunded",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "razorpay",
  "cod",
  "upi",
  "card",
  "netbanking",
  "wallet",
]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    razorpayOrderId: text("razorpay_order_id"),
    amount: real("amount").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    method: paymentMethodEnum("method").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("payments_order_id_idx").on(table.orderId),
    razorpayPaymentIdIdx: index("payments_razorpay_payment_id_idx").on(
      table.razorpayPaymentId,
    ),
    razorpayOrderIdIdx: index("payments_razorpay_order_id_idx").on(
      table.razorpayOrderId,
    ),
    statusIdx: index("payments_status_idx").on(table.status),
  }),
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
