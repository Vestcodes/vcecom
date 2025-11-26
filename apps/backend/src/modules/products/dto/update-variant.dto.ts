import { ApiProperty } from "@nestjs/swagger";
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateVariantDto {
  @ApiProperty({
    description: "SKU (Stock Keeping Unit)",
    example: "PROD-001-SM-RED",
    required: false,
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: "SKU must be a string" })
  @MaxLength(100, { message: "SKU must not exceed 100 characters" })
  sku?: string;

  @ApiProperty({
    description: "Variant price in INR",
    example: 2999.99,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: "Price must be a number" })
  @Min(0, { message: "Price must be greater than or equal to 0" })
  price?: number;

  @ApiProperty({
    description: "Inventory quantity",
    example: 100,
    required: false,
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
