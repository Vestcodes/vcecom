import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
    type: String,
  })
  email: string;

  @ApiProperty({
    description: "User password (minimum 8 characters)",
    example: "SecurePassword123!",
    type: String,
    minLength: 8,
  })
  password: string;

  @ApiProperty({
    description: "User role",
    example: "customer",
    enum: ["admin", "customer"],
    required: false,
    default: "customer",
  })
  role?: "admin" | "customer";
}
