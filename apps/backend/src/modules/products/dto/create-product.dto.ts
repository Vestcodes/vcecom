import { ApiProperty } from "@nestjs/swagger";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateProductDto {
  @ApiProperty({
    description: "Product title",
    example: "Wireless Bluetooth Headphones",
    maxLength: 255,
  })
  @IsNotEmpty({ message: "Title is required" })
  @IsString({ message: "Title must be a string" })
  @MaxLength(255, { message: "Title must not exceed 255 characters" })
  title: string;

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
    minimum: 0,
  })
  @IsNotEmpty({ message: "Price is required" })
  @IsNumber({}, { message: "Price must be a number" })
  @Min(0, { message: "Price must be greater than or equal to 0" })
  price: number;

  @ApiProperty({
    description: "GST rate percentage",
    example: 18,
    default: 0,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: "GST rate must be a number" })
  @Min(0, { message: "GST rate must be greater than or equal to 0" })
  @Max(100, { message: "GST rate must be less than or equal to 100" })
  gstRate?: number;

  @ApiProperty({
    description: "Product status",
    example: "draft",
    enum: ["draft", "active", "archived"],
    default: "draft",
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
