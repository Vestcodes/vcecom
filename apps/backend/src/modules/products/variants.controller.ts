import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreateVariantDto } from "./dto/create-variant.dto";
import { UpdateVariantDto } from "./dto/update-variant.dto";
import { VariantResponseDto } from "./dto/variant-response.dto";
import { VariantsService } from "./variants.service";

@ApiTags("product-variants")
@Controller("products/:productId/variants")
export class VariantsController {
  constructor(private readonly variantsService: VariantsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: "Get all variants for a product",
    description:
      "Retrieve all variants for a specific product (public endpoint)",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "List of variants retrieved successfully",
    type: [VariantResponseDto],
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  async findByProductId(
    @Param("productId") productId: string,
  ): Promise<VariantResponseDto[]> {
    return this.variantsService.findByProductId(productId);
  }

  @Public()
  @Get(":id")
  @ApiOperation({
    summary: "Get variant by ID",
    description: "Retrieve a single variant by its ID (public endpoint)",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant retrieved successfully",
    type: VariantResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Variant not found",
  })
  async findOne(@Param("id") id: string): Promise<VariantResponseDto> {
    return this.variantsService.findOne(id);
  }

  @Public()
  @Get("sku/:sku")
  @ApiOperation({
    summary: "Get variant by SKU",
    description: "Retrieve a single variant by its SKU (public endpoint)",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "sku",
    description: "Variant SKU",
    example: "PROD-001-SM-RED",
  })
  @ApiOkResponse({
    description: "Variant retrieved successfully",
    type: VariantResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Variant not found",
  })
  async findBySku(@Param("sku") sku: string): Promise<VariantResponseDto> {
    return this.variantsService.findBySku(sku);
  }

  @Post()
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create a new product variant",
    description: "Create a new variant for a product (admin only)",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "Variant created successfully",
    type: VariantResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or product not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async create(
    @Param("productId") productId: string,
    @Body() createVariantDto: CreateVariantDto,
  ): Promise<VariantResponseDto> {
    // Override productId from path
    createVariantDto.productId = productId;
    return this.variantsService.create(createVariantDto);
  }

  @Put(":id")
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update a product variant",
    description: "Update an existing variant (admin only)",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant updated successfully",
    type: VariantResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Variant not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input or SKU already exists",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async update(
    @Param("id") id: string,
    @Body() updateVariantDto: UpdateVariantDto,
  ): Promise<VariantResponseDto> {
    return this.variantsService.update(id, updateVariantDto);
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete a product variant",
    description:
      "Delete a variant (admin only). Variant images will be cascade deleted.",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Variant deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Variant deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Variant not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async remove(@Param("id") id: string) {
    return this.variantsService.remove(id);
  }
}
