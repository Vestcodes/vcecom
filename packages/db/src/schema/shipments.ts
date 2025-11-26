import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { orders } from "./orders";

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "pending",
  "label_generated",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
]);

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    provider: text("provider").notNull(), // shiprocket, nimbus_post, etc.
    trackingNumber: text("tracking_number").unique(),
    status: shipmentStatusEnum("status").notNull().default("pending"),
    labelUrl: text("label_url"),
    awbNumber: text("awb_number").unique(), // Airway Bill Number
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdIdx: index("shipments_order_id_idx").on(table.orderId),
    trackingNumberIdx: index("shipments_tracking_number_idx").on(
      table.trackingNumber,
    ),
    awbNumberIdx: index("shipments_awb_number_idx").on(table.awbNumber),
    statusIdx: index("shipments_status_idx").on(table.status),
    providerIdx: index("shipments_provider_idx").on(table.provider),
  }),
);

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  order: one(orders, {
    fields: [shipments.orderId],
    references: [orders.id],
  }),
}));

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
