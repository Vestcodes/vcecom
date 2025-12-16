import { ApiProperty } from "@nestjs/swagger";

export enum SaleStatus {
  SCHEDULED = "scheduled",
  ACTIVE = "active",
  EXPIRED = "expired",
  DISABLED = "disabled",
}

export class SaleResponseDto {
  @ApiProperty({
    description: "Sale ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productId: string;

  @ApiProperty({
    description: "Sale price",
    example: 79.99,
  })
  salePrice: number;

  @ApiProperty({
    description: "Sale start date",
    example: "2025-01-01T00:00:00.000Z",
    nullable: true,
  })
  startDate: Date | null;

  @ApiProperty({
    description: "Sale end date",
    example: "2025-12-31T23:59:59.000Z",
    nullable: true,
  })
  endDate: Date | null;

  @ApiProperty({
    description: "Sale status",
    enum: SaleStatus,
    example: SaleStatus.ACTIVE,
  })
  status: SaleStatus;

  @ApiProperty({
    description: "Whether sale is active",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "Sale name",
    example: "Summer Sale 2025",
    nullable: true,
  })
  name: string | null;

  @ApiProperty({
    description: "Sale description",
    example: "Special summer discount",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Priority (higher priority wins)",
    example: 0,
  })
  priority: number;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}

export class EffectivePriceResponseDto {
  @ApiProperty({
    description: "Regular product price",
    example: 99.99,
  })
  price: number;

  @ApiProperty({
    description: "Sale price if active",
    example: 79.99,
    nullable: true,
  })
  salePrice: number | null;

  @ApiProperty({
    description: "Whether product is on sale",
    example: true,
  })
  isOnSale: boolean;

  @ApiProperty({
    description: "Sale ID if on sale",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  saleId?: string;
}
