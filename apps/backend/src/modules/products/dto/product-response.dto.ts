import { ApiProperty } from "@nestjs/swagger";

export class ProductResponseDto {
  @ApiProperty({
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Product title",
    example: "Wireless Bluetooth Headphones",
  })
  title: string;

  @ApiProperty({
    description: "Product description",
    example: "High-quality wireless headphones with noise cancellation",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Product price in INR",
    example: 2999.99,
  })
  price: number;

  @ApiProperty({
    description: "GST rate percentage",
    example: 18,
  })
  gstRate: number;

  @ApiProperty({
    description: "GST amount (calculated from price)",
    example: 540.0,
  })
  gstAmount: number;

  @ApiProperty({
    description: "Price excluding GST",
    example: 3000.0,
  })
  priceExcludingGst: number;

  @ApiProperty({
    description: "Price including GST",
    example: 3540.0,
  })
  priceIncludingGst: number;

  @ApiProperty({
    description: "HSN (Harmonized System of Nomenclature) code",
    example: "8518.12.00",
    nullable: true,
  })
  hsnCode: string | null;

  @ApiProperty({
    description: "Product status",
    example: "active",
    enum: ["draft", "active", "archived"],
  })
  status: "draft" | "active" | "archived";

  @ApiProperty({
    description: "Category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  categoryId: string | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  updatedAt: Date;
}

export class PaginatedProductsResponseDto {
  @ApiProperty({
    description: "List of products",
    type: [ProductResponseDto],
  })
  data: ProductResponseDto[];

  @ApiProperty({
    description: "Total number of products",
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: "Current page number",
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: "Number of items per page",
    example: 10,
  })
  limit: number;

  @ApiProperty({
    description: "Total number of pages",
    example: 10,
  })
  totalPages: number;
}
