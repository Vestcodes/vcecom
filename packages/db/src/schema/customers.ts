import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    email: text("email").notNull().unique(),
    phone: text("phone").notNull().unique(),
    name: text("name").notNull(),
    gstin: text("gstin").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("customers_email_idx").on(table.email),
    phoneIdx: index("customers_phone_idx").on(table.phone),
    userIdIdx: index("customers_user_id_idx").on(table.userId),
    gstinIdx: index("customers_gstin_idx").on(table.gstin),
  }),
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
