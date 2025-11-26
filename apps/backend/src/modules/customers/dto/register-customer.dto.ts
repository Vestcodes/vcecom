import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterCustomerDto {
  @ApiProperty({
    description: "Customer email address",
    example: "customer@example.com",
  })
  @IsNotEmpty({ message: "Email is required" })
  @IsEmail({}, { message: "Email must be a valid email address" })
  email: string;

  @ApiProperty({
    description: "Customer password (minimum 8 characters)",
    example: "SecurePassword123!",
    minLength: 8,
  })
  @IsNotEmpty({ message: "Password is required" })
  @IsString({ message: "Password must be a string" })
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  password: string;

  @ApiProperty({
    description: "Customer name",
    example: "John Doe",
  })
  @IsNotEmpty({ message: "Name is required" })
  @IsString({ message: "Name must be a string" })
  @MaxLength(255, { message: "Name must not exceed 255 characters" })
  name: string;

  @ApiProperty({
    description: "Customer phone number (10 digits, Indian format)",
    example: "9876543210",
    pattern: "^[6-9]\\d{9}$",
  })
  @IsNotEmpty({ message: "Phone is required" })
  @IsString({ message: "Phone must be a string" })
  @Matches(/^[6-9]\d{9}$/, {
    message: "Phone must be a valid 10-digit Indian mobile number",
  })
  phone: string;

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
