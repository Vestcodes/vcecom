import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateCategoryDto {
  @ApiProperty({
    description: "Category name",
    example: "Electronics",
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name?: string;

  @ApiProperty({
    description: "Category slug",
    example: "electronics",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Slug must be a string" })
  @MaxLength(255, { message: "Slug must not exceed 255 characters" })
  slug?: string;

  @ApiProperty({
    description: "Parent category ID (for hierarchical categories)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID(4, { message: "Parent ID must be a valid UUID" })
  parentId?: string;

  @ApiProperty({
    description: "Category description",
    example: "Electronic devices and accessories",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(1000, { message: "Description must not exceed 1000 characters" })
  description?: string;

  @ApiProperty({
    description: "Category image URL",
    example: "https://example.com/images/electronics.jpg",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Image URL must be a string" })
  @MaxLength(500, { message: "Image URL must not exceed 500 characters" })
  imageUrl?: string;
}
