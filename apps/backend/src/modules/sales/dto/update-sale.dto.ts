import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateSaleDto {
  @ApiProperty({
    description: "Sale price (must be less than product's regular price)",
    example: 69.99,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Sale price must be a number" })
  @Min(0, { message: "Sale price must be greater than or equal to 0" })
  salePrice?: number;

  @ApiProperty({
    description: "Sale start date (null = always active)",
    example: "2025-01-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "Start date must be a valid date string" })
  startDate?: string | null;

  @ApiProperty({
    description: "Sale end date (null = no expiry)",
    example: "2025-12-31T23:59:59.000Z",
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: "End date must be a valid date string" })
  endDate?: string | null;

  @ApiProperty({
    description: "Sale name",
    example: "Summer Sale 2025",
    required: false,
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name?: string;

  @ApiProperty({
    description: "Sale description",
    example: "Special summer discount",
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @MaxLength(1000, { message: "Description must not exceed 1000 characters" })
  description?: string;

  @ApiProperty({
    description: "Priority (higher priority wins if multiple sales exist)",
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Priority must be an integer" })
  priority?: number;

  @ApiProperty({
    description: "Whether sale is active",
    example: true,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: "Is active must be a boolean" })
  isActive?: boolean;
}
