import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, Min } from "class-validator";

export class UpdateItemDto {
  @ApiProperty({
    description: "Quantity",
    example: 2,
    minimum: 1,
  })
  @IsNotEmpty({ message: "Quantity is required" })
  @IsInt({ message: "Quantity must be an integer" })
  @Min(1, { message: "Quantity must be at least 1" })
  quantity: number;
}
