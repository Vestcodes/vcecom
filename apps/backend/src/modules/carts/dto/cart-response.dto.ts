import { ApiProperty } from "@nestjs/swagger";

export class CartItemResponseDto {
  @ApiProperty({
    description: "Cart item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  productVariantId: string;

  @ApiProperty({
    description: "Quantity",
    example: 2,
  })
  quantity: number;

  @ApiProperty({
    description: "Price at time of adding to cart",
    example: 999.99,
  })
  price: number;

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

export class CartResponseDto {
  @ApiProperty({
    description: "Cart ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Customer ID (null for guest carts)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  customerId: string | null;

  @ApiProperty({
    description: "Session ID (for guest carts)",
    example: "session_abc123",
    nullable: true,
  })
  sessionId: string | null;

  @ApiProperty({
    description: "Cart subtotal (before GST)",
    example: 1999.98,
  })
  subtotal: number;

  @ApiProperty({
    description: "GST amount",
    example: 359.99,
  })
  gstAmount: number;

  @ApiProperty({
    description: "Cart total (subtotal + GST)",
    example: 2359.97,
  })
  total: number;

  @ApiProperty({
    description: "Cart items",
    type: [CartItemResponseDto],
  })
  items: CartItemResponseDto[];

  @ApiProperty({
    description: "Cart expiration timestamp",
    example: "2025-12-03T00:00:00.000Z",
    nullable: true,
  })
  expiresAt: Date | null;

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
