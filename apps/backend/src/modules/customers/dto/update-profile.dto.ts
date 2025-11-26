import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @ApiProperty({
    description: "Customer name",
    example: "John Doe",
    required: false,
  })
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name?: string;

  @ApiProperty({
    description: "Customer phone number (10 digits, Indian format)",
    example: "9876543210",
    required: false,
    pattern: "^[6-9]\\d{9}$",
  })
  @IsOptional()
  @IsString({ message: "Phone must be a string" })
  @Matches(/^[6-9]\d{9}$/, {
    message: "Phone must be a valid 10-digit Indian mobile number",
  })
  phone?: string;

  @ApiProperty({
    description: "GSTIN (GST Identification Number) - 15 characters",
    example: "27ABCDE1234F1Z5",
    required: false,
    maxLength: 15,
  })
  @IsOptional()
  @IsString({ message: "GSTIN must be a string" })
  @MaxLength(15, { message: "GSTIN must be exactly 15 characters" })
  gstin?: string;
}
