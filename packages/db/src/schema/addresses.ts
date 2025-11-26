import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers";

export const addressTypeEnum = pgEnum("address_type", [
  "shipping",
  "billing",
  "both",
]);

export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    type: addressTypeEnum("type").notNull().default("shipping"),
    street: text("street").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    district: text("district"),
    country: text("country").notNull().default("India"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    customerIdIdx: index("addresses_customer_id_idx").on(table.customerId),
    pincodeIdx: index("addresses_pincode_idx").on(table.pincode),
    defaultIdx: index("addresses_customer_default_idx").on(
      table.customerId,
      table.isDefault,
    ),
  }),
);

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;
