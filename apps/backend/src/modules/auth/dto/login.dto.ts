import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class LoginDto {
  @ApiProperty({
    description: "User email address or phone number",
    example: "user@example.com",
    type: String,
  })
  @IsNotEmpty({ message: "Email or phone is required" })
  @IsString({ message: "Email or phone must be a string" })
  email: string;

  @ApiProperty({
    description: "User password",
    example: "SecurePassword123!",
    type: String,
    minLength: 8,
  })
  @IsNotEmpty({ message: "Password is required" })
  @IsString({ message: "Password must be a string" })
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  password: string;
}
