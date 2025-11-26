import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
});
