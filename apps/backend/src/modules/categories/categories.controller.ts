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
import { CategoriesService } from "./categories.service";
import {
  CategoryResponseDto,
  CategoryTreeDto,
} from "./dto/category-response.dto";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@ApiTags("categories")
@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: "Get all categories",
    description: "Retrieve a list of all categories (public endpoint)",
  })
  @ApiOkResponse({
    description: "List of categories retrieved successfully",
    type: [CategoryResponseDto],
  })
  async findAll(): Promise<CategoryResponseDto[]> {
    return this.categoriesService.findAll();
  }

  @Public()
  @Get("tree")
  @ApiOperation({
    summary: "Get category tree",
    description:
      "Retrieve categories in hierarchical tree structure (public endpoint)",
  })
  @ApiOkResponse({
    description: "Category tree retrieved successfully",
    type: [CategoryTreeDto],
  })
  async findTree(): Promise<CategoryTreeDto[]> {
    return this.categoriesService.findTree();
  }

  @Public()
  @Get(":id")
  @ApiOperation({
    summary: "Get category by ID",
    description: "Retrieve a single category by its ID (public endpoint)",
  })
  @ApiParam({
    name: "id",
    description: "Category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Category retrieved successfully",
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Category not found",
  })
  async findOne(@Param("id") id: string): Promise<CategoryResponseDto> {
    return this.categoriesService.findOne(id);
  }

  @Public()
  @Get("slug/:slug")
  @ApiOperation({
    summary: "Get category by slug",
    description: "Retrieve a single category by its slug (public endpoint)",
  })
  @ApiParam({
    name: "slug",
    description: "Category slug",
    example: "electronics",
  })
  @ApiOkResponse({
    description: "Category retrieved successfully",
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Category not found",
  })
  async findBySlug(@Param("slug") slug: string): Promise<CategoryResponseDto> {
    return this.categoriesService.findBySlug(slug);
  }

  @Post()
  @Roles("admin")
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Create a new category",
    description: "Create a new category (admin only)",
  })
  @ApiCreatedResponse({
    description: "Category created successfully",
    type: CategoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or parent category not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.create(createCategoryDto);
  }

  @Put(":id")
  @Roles("admin")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update a category",
    description: "Update an existing category (admin only)",
  })
  @ApiParam({
    name: "id",
    description: "Category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Category updated successfully",
    type: CategoryResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Category not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input, circular reference, or parent not found",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async update(
    @Param("id") id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(":id")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete a category",
    description:
      "Delete a category (admin only). Cannot delete categories with children.",
  })
  @ApiParam({
    name: "id",
    description: "Category ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Category deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Category deleted successfully",
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: "Category not found",
  })
  @ApiBadRequestResponse({
    description: "Cannot delete category with children",
  })
  @ApiUnauthorizedResponse({
    description: "Authentication required",
  })
  @ApiForbiddenResponse({
    description: "Access denied. Admin role required.",
  })
  async remove(@Param("id") id: string) {
    return this.categoriesService.remove(id);
  }
}
