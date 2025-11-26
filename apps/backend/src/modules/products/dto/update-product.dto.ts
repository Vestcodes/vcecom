import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateProductDto {
  @ApiProperty({
    description: "Product title",
    example: "Wireless Bluetooth Headphones",
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: "Title must be a string" })
  @MaxLength(255, { message: "Title must not exceed 255 characters" })
  title?: string;

  @ApiProperty({
    description: "Product description",
    example: "High-quality wireless headphones with noise cancellation",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(5000, { message: "Description must not exceed 5000 characters" })
  description?: string;

  @ApiProperty({
    description: "Product price in INR",
    example: 2999.99,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: "Price must be a number" })
  @Min(0, { message: "Price must be greater than or equal to 0" })
  price?: number;

  @ApiProperty({
    description: "GST rate percentage (valid rates: 0%, 5%, 12%, 18%, 28%)",
    example: 18,
    required: false,
    enum: [0, 5, 12, 18, 28],
  })
  @IsOptional()
  @IsNumber()
  @IsIn([0, 5, 12, 18, 28], {
    message: "GST rate must be one of: 0%, 5%, 12%, 18%, 28%",
  })
  gstRate?: number;

  @ApiProperty({
    description: "HSN (Harmonized System of Nomenclature) code",
    example: "8518.12.00",
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "HSN code must not exceed 50 characters" })
  hsnCode?: string;

  @ApiProperty({
    description: "Product status",
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
    description: "Category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID(4, { message: "Category ID must be a valid UUID" })
  categoryId?: string;
}
