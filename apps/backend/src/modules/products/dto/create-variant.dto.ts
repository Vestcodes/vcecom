import { ApiProperty } from "@nestjs/swagger";
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateVariantDto {
  @ApiProperty({
    description: "Product ID this variant belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty({ message: "Product ID is required" })
  @IsUUID(4, { message: "Product ID must be a valid UUID" })
  productId: string;

  @ApiProperty({
    description: "SKU (Stock Keeping Unit) - auto-generated if not provided",
    example: "PROD-001-SM-RED",
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: "SKU must be a string" })
  @MaxLength(100, { message: "SKU must not exceed 100 characters" })
  sku?: string;

  @ApiProperty({
    description: "Variant price in INR (can differ from base product price)",
    example: 2999.99,
    minimum: 0,
  })
  @IsNotEmpty({ message: "Price is required" })
  @IsNumber({}, { message: "Price must be a number" })
  @Min(0, { message: "Price must be greater than or equal to 0" })
  price: number;

  @ApiProperty({
    description: "Inventory quantity",
    example: 100,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: "Inventory must be an integer" })
  @Min(0, { message: "Inventory must be greater than or equal to 0" })
  inventory?: number;

  @ApiProperty({
    description: "Variant size",
    example: "Small",
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: "Size must be a string" })
  @MaxLength(50, { message: "Size must not exceed 50 characters" })
  size?: string;

  @ApiProperty({
    description: "Variant color",
    example: "Red",
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: "Color must be a string" })
  @MaxLength(50, { message: "Color must not exceed 50 characters" })
  color?: string;

  @ApiProperty({
    description: "Variant weight in kg",
    example: 0.5,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: "Weight must be a number" })
  @Min(0, { message: "Weight must be greater than or equal to 0" })
  weight?: number;
}
