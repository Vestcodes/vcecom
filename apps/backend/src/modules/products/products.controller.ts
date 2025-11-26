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
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreateProductDto } from "./dto/create-product.dto";
import {
  PaginatedProductsResponseDto,
  ProductResponseDto,
} from "./dto/product-response.dto";
import { QueryProductsDto } from "./dto/query-products.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { ProductsService } from "./products.service";

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: "Get all products",
    description:
      "Retrieve a paginated list of products with optional filters (public endpoint)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10, max: 100)",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["draft", "active", "archived"],
    description: "Filter by status",
  })
  @ApiQuery({
    name: "categoryId",
    required: false,
    type: String,
    description: "Filter by category ID",
  })
  @ApiOkResponse({
    description: "List of products retrieved successfully",
    type: PaginatedProductsResponseDto,
  })
  async findAll(
    @Query() query: QueryProductsDto,
  ): Promise<PaginatedProductsResponseDto> {
    return this.productsService.findAll(query);
  }

  @Public()
  @Get(":id")
  @ApiOperation({
    summary: "Get product by ID",
    description: "Retrieve a single product by its ID (public endpoint)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Product retrieved successfully",
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  async findOne(@Param("id") id: string): Promise<ProductResponseDto> {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create a new product",
    description: "Create a new product (admin only)",
  })
  @ApiOkResponse({
    description: "Product created successfully",
    type: ProductResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or category not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async create(
    @Body() createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.create(createProductDto);
  }

  @Put(":id")
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update a product",
    description: "Update an existing product (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Product updated successfully",
    type: ProductResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input or category not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async update(
    @Param("id") id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete a product",
    description:
      "Delete a product (admin only). Variants and images will be cascade deleted.",
  })
  @ApiParam({
    name: "id",
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Product deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Product deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Product not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }
}
