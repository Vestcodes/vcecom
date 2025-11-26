import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsUUID, Min } from "class-validator";

export class AddItemDto {
  @ApiProperty({
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty({ message: "Product variant ID is required" })
  @IsUUID(4, { message: "Product variant ID must be a valid UUID" })
  productVariantId: string;

  @ApiProperty({
    description: "Quantity",
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsNotEmpty({ message: "Quantity is required" })
  @IsInt({ message: "Quantity must be an integer" })
  @Min(1, { message: "Quantity must be at least 1" })
  quantity: number;
}
