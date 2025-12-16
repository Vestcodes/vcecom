import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { CreateSaleDto } from "./dto/create-sale.dto";
import {
  EffectivePriceResponseDto,
  SaleResponseDto,
} from "./dto/sale-response.dto";
import { UpdateSaleDto } from "./dto/update-sale.dto";
import { SalesService } from "./sales.service";

@ApiTags("admin/sales")
@Controller("admin/sales")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth("JWT-auth")
@Roles("admin")
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new product sale",
    description:
      "Create a new sale for a product with optional date range. Admin-only endpoint.",
  })
  @ApiResponse({
    status: 201,
    description: "Sale created successfully",
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Bad request - Invalid sale data or sale price >= regular price",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  @ApiResponse({
    status: 404,
    description: "Product not found",
  })
  async create(@Body() createSaleDto: CreateSaleDto): Promise<SaleResponseDto> {
    return this.salesService.create(createSaleDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all sales",
    description:
      "Retrieve a list of all sales with optional filters. Admin-only endpoint.",
  })
  @ApiQuery({
    name: "productId",
    required: false,
    type: String,
    description: "Filter by product ID",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["scheduled", "active", "expired", "disabled"],
    description: "Filter by status",
  })
  @ApiResponse({
    status: 200,
    description: "List of sales retrieved successfully",
    type: [SaleResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findAll(
    @Query("productId") productId?: string,
    @Query("status") status?: "scheduled" | "active" | "expired" | "disabled",
  ): Promise<SaleResponseDto[]> {
    return this.salesService.findAll(productId, status);
  }

  @Get("product/:productId")
  @ApiOperation({
    summary: "Get active sale for a product",
    description:
      "Get the currently active sale price for a product. Admin-only endpoint.",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Effective price retrieved successfully",
    type: EffectivePriceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Product not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async getProductSale(
    @Param("productId") productId: string,
  ): Promise<EffectivePriceResponseDto> {
    return this.salesService.getEffectivePrice(productId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get sale by ID",
    description: "Retrieve a specific sale by ID. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Sale ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Sale retrieved successfully",
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Sale not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async findOne(@Param("id") id: string): Promise<SaleResponseDto> {
    return this.salesService.findOne(id);
  }

  @Put(":id")
  @ApiOperation({
    summary: "Update sale",
    description: "Update an existing sale. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Sale ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Sale updated successfully",
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid sale data",
  })
  @ApiResponse({
    status: 404,
    description: "Sale not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async update(
    @Param("id") id: string,
    @Body() updateSaleDto: UpdateSaleDto,
  ): Promise<SaleResponseDto> {
    return this.salesService.update(id, updateSaleDto);
  }

  @Patch(":id/status")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update sale status",
    description: "Update the active status of a sale. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Sale ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Sale status updated successfully",
    type: SaleResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Sale not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async updateStatus(
    @Param("id") id: string,
    @Body() body: { isActive: boolean },
  ): Promise<SaleResponseDto> {
    return this.salesService.updateStatus(id, body.isActive);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Delete sale",
    description: "Delete a sale. Admin-only endpoint.",
  })
  @ApiParam({
    name: "id",
    description: "Sale ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Sale deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Sale deleted successfully",
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "Sale not found",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async remove(@Param("id") id: string): Promise<{ message: string }> {
    await this.salesService.remove(id);
    return { message: "Sale deleted successfully" };
  }
}
