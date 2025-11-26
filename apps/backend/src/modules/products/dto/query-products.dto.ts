import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";

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
}
