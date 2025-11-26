import { ApiProperty } from "@nestjs/swagger";

export class CategoryResponseDto {
  @ApiProperty({
    description: "Category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Category name",
    example: "Electronics",
  })
  name: string;

  @ApiProperty({
    description: "Category slug",
    example: "electronics",
  })
  slug: string;

  @ApiProperty({
    description: "Parent category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  parentId: string | null;

  @ApiProperty({
    description: "Category description",
    example: "Electronic devices and accessories",
    nullable: true,
  })
  description: string | null;

  @ApiProperty({
    description: "Category image URL",
    example: "https://example.com/images/electronics.jpg",
    nullable: true,
  })
  imageUrl: string | null;

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

export class CategoryTreeDto extends CategoryResponseDto {
  @ApiProperty({
    description: "Child categories",
    type: [CategoryResponseDto],
  })
  children?: CategoryTreeDto[];
}
