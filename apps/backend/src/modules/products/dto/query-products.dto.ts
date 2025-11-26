import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class QueryProductsDto {
  @ApiProperty({
    description: "Page number (1-indexed)",
    example: 1,
    default: 1,
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Page must be an integer" })
  @Min(1, { message: "Page must be greater than or equal to 1" })
  page?: number = 1;

  @ApiProperty({
    description: "Number of items per page",
    example: 10,
    default: 10,
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Limit must be an integer" })
  @Min(1, { message: "Limit must be greater than or equal to 1" })
  @Max(100, { message: "Limit must be less than or equal to 100" })
  limit?: number = 10;

  @ApiProperty({
    description: "Search query (searches in title, description, and SKU)",
    example: "wireless headphones",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Search query must be a string" })
  search?: string;

  @ApiProperty({
    description: "Filter by status",
    example: "active",
    enum: ["draft", "active", "archived"],
    required: false,
  })
  @IsOptional()
  @IsEnum(["draft", "active", "archived"], {
    message: "Status must be one of: draft, active, archived",
  })
  status?: "draft" | "active" | "archived";

  @ApiProperty({
    description: "Filter by category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID(4, { message: "Category ID must be a valid UUID" })
  categoryId?: string;

  @ApiProperty({
    description: "Minimum price filter (INR)",
    example: 1000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Min price must be a number" })
  @Min(0, { message: "Min price must be greater than or equal to 0" })
  minPrice?: number;

  @ApiProperty({
    description: "Maximum price filter (INR)",
    example: 5000,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Max price must be a number" })
  @Min(0, { message: "Max price must be greater than or equal to 0" })
  maxPrice?: number;

  @ApiProperty({
    description: "Filter by availability (in stock/out of stock)",
    example: true,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: "In stock must be a boolean" })
  inStock?: boolean;

  @ApiProperty({
    description: "Sort field",
    example: "price",
    enum: ["price", "name", "date"],
    default: "date",
    required: false,
  })
  @IsOptional()
  @IsEnum(["price", "name", "date"], {
    message: "Sort must be one of: price, name, date",
  })
  sortBy?: "price" | "name" | "date" = "date";

  @ApiProperty({
    description: "Sort order",
    example: "asc",
    enum: ["asc", "desc"],
    default: "desc",
    required: false,
  })
  @IsOptional()
  @IsEnum(["asc", "desc"], {
    message: "Sort order must be one of: asc, desc",
  })
  sortOrder?: "asc" | "desc" = "desc";
}
