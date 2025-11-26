import { ApiProperty } from "@nestjs/swagger";

export class CustomerProfileDto {
  @ApiProperty({
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "User ID (linked to auth)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  userId: string;

  @ApiProperty({
    description: "Customer email address",
    example: "customer@example.com",
  })
  email: string;

  @ApiProperty({
    description: "Customer phone number",
    example: "9876543210",
  })
  phone: string;

  @ApiProperty({
    description: "Customer name",
    example: "John Doe",
  })
  name: string;

  @ApiProperty({
    description: "GSTIN (GST Identification Number)",
    example: "27ABCDE1234F1Z5",
    nullable: true,
  })
  gstin: string | null;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2025-11-26T00:00:00.000Z",
  })
  updatedAt: Date;
}
