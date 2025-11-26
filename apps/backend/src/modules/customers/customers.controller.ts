import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Request,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CustomersService } from "./customers.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { CustomerProfileDto } from "./dto/customer-profile.dto";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@ApiTags("customers")
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Register a new customer",
    description:
      "Create a new customer account with email, password, name, and phone. Returns access token and refresh token.",
  })
  @ApiCreatedResponse({
    description: "Customer successfully registered",
    schema: {
      type: "object",
      properties: {
        access_token: { type: "string" },
        refresh_token: { type: "string" },
        customer: { $ref: "#/components/schemas/CustomerProfileDto" },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      "Invalid input, email/phone/GSTIN already exists, or invalid GSTIN format",
  })
  async register(@Body() registerDto: RegisterCustomerDto) {
    return this.customersService.register(registerDto);
  }

  @Get("me")
  @Roles("customer")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get current customer profile",
    description: "Get the profile of the currently authenticated customer",
  })
  @ApiOkResponse({
    description: "Customer profile retrieved successfully",
    type: CustomerProfileDto,
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async getProfile(@Request() req): Promise<CustomerProfileDto> {
    return this.customersService.getProfile(req.user.id);
  }

  @Put("me")
  @Roles("customer")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update customer profile",
    description: "Update the profile of the currently authenticated customer",
  })
  @ApiOkResponse({
    description: "Customer profile updated successfully",
    type: CustomerProfileDto,
  })
  @ApiBadRequestResponse({
    description:
      "Invalid input, phone/GSTIN already exists, or invalid GSTIN format",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  async updateProfile(
    @Request() req,
    @Body() updateDto: UpdateProfileDto,
  ): Promise<CustomerProfileDto> {
    return this.customersService.updateProfile(req.user.id, updateDto);
  }

  @Post("change-password")
  @Roles("customer")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Change customer password",
    description: "Change the password of the currently authenticated customer",
  })
  @ApiOkResponse({
    description: "Password changed successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Password changed successfully",
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Invalid input",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required or current password incorrect",
  })
  async changePassword(
    @Request() req,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.customersService.changePassword(req.user.id, changePasswordDto);
  }
}
