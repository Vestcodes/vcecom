import { ApiProperty } from "@nestjs/swagger";

export class VariantResponseDto {
  @ApiProperty({
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Product ID this variant belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productId: string;

  @ApiProperty({
    description: "SKU (Stock Keeping Unit)",
    example: "PROD-001-SM-RED",
  })
  sku: string;

  @ApiProperty({
    description: "Variant price in INR",
    example: 2999.99,
  })
  price: number;

  @ApiProperty({
    description: "Inventory quantity",
    example: 100,
  })
  inventory: number;

  @ApiProperty({
    description: "Variant size",
    example: "Small",
    nullable: true,
  })
  size: string | null;

  @ApiProperty({
    description: "Variant color",
    example: "Red",
    nullable: true,
  })
  color: string | null;

  @ApiProperty({
    description: "Variant weight in kg",
    example: 0.5,
    nullable: true,
  })
  weight: number | null;

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
