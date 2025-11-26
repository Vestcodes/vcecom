# @vcecom/db

Shared database package for VCEcom using Drizzle ORM and PostgreSQL.

## Setup

1. Set `DATABASE_URL` environment variable:
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/vcecom"
   ```

2. Generate migrations:
   ```bash
   pnpm db:generate
   ```

3. Run migrations:
   ```bash
   pnpm db:migrate
   ```

   Or use the push command for development:
   ```bash
   pnpm db:push
   ```

## Scripts

- `db:generate` - Generate migration files from schema changes
- `db:migrate` - Run migrations using drizzle-kit
- `db:push` - Push schema changes directly to database (development only)
- `db:studio` - Open Drizzle Studio for database inspection
- `build` - Compile TypeScript to JavaScript
- `check-types` - Type check without emitting files

## Schema Structure

All schemas are located in `src/schema/`:

- `users.ts` - User authentication
- `customers.ts` - Customer profiles
- `addresses.ts` - Customer addresses
- `categories.ts` - Product categories (hierarchical)
- `products.ts` - Products with GST support
- `product-variants.ts` - Product variants (size, color, etc.)
- `product-images.ts` - Product images
- `carts.ts` - Shopping carts
- `cart-items.ts` - Cart line items
- `orders.ts` - Orders
- `order-items.ts` - Order line items
- `payments.ts` - Payment records
- `shipments.ts` - Shipment tracking

## Migrations

Migrations are stored in `drizzle/` directory. To create a new migration:

1. Make changes to schema files
2. Run `pnpm db:generate` to generate migration SQL
3. Review the generated migration files
4. Run `pnpm db:migrate` to apply migrations

## Development

For development, you can use `db:push` which directly syncs your schema to the database without creating migration files. This is useful during active development but should not be used in production.

## Testing

Tests are located alongside schema files with `.test.ts` suffix. Run tests with:

```bash
pnpm test
```

Make sure `TEST_DATABASE_URL` or `DATABASE_URL` is set for tests to run.
