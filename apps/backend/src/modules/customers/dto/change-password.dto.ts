import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({
    description: "Current password",
    example: "CurrentPassword123!",
  })
  @IsNotEmpty({ message: "Current password is required" })
  @IsString({ message: "Current password must be a string" })
  currentPassword: string;

  @ApiProperty({
    description: "New password (minimum 8 characters)",
    example: "NewSecurePassword123!",
    minLength: 8,
  })
  @IsNotEmpty({ message: "New password is required" })
  @IsString({ message: "New password must be a string" })
  @MinLength(8, { message: "New password must be at least 8 characters long" })
  newPassword: string;
}
