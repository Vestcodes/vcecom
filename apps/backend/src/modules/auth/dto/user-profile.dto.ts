import { ApiProperty } from "@nestjs/swagger";

export class UserProfileDto {
  @ApiProperty({
    description: "User ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  email: string;

  @ApiProperty({
    description: "User role",
    example: "customer",
    enum: ["admin", "customer"],
  })
  role: "admin" | "customer";
}
