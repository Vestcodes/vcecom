import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CartsService } from "./carts.service";
import { AddItemDto } from "./dto/add-item.dto";
import { CartResponseDto } from "./dto/cart-response.dto";
import { UpdateItemDto } from "./dto/update-item.dto";

@ApiTags("carts")
@Controller("cart")
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "Get cart",
    description:
      "Get cart for authenticated customer or guest session. Creates cart if it doesn't exist.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiOkResponse({
    description: "Cart retrieved successfully",
    type: CartResponseDto,
  })
  async getCart(
    @Request() req,
    @Headers("x-session-id") sessionId?: string,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    return this.cartsService.getCart(userId, sessionId || null);
  }

  @Post("items")
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Add item to cart",
    description:
      "Add a product variant to cart. Creates cart if it doesn't exist. For authenticated users, uses customer cart. For guests, requires session ID.",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiCreatedResponse({
    description: "Item added to cart successfully",
    type: CartResponseDto,
  })
  @ApiBadRequestResponse({
    description: "Invalid input or insufficient inventory",
  })
  @ApiNotFoundResponse({
    description: "Product variant not found",
  })
  async addItem(
    @Request() req,
    @Body() addItemDto: AddItemDto,
    @Headers("x-session-id") sessionId?: string,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    return this.cartsService.addItem(userId, sessionId || null, addItemDto);
  }

  @Put("items/:id")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update cart item quantity",
    description: "Update the quantity of an item in the cart",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiParam({
    name: "id",
    description: "Cart item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Cart item updated successfully",
    type: CartResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Cart item not found",
  })
  @ApiBadRequestResponse({
    description: "Invalid input or insufficient inventory",
  })
  async updateItem(
    @Request() req,
    @Param("id") id: string,
    @Body() updateDto: UpdateItemDto,
    @Headers("x-session-id") sessionId?: string,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    return this.cartsService.updateItem(
      userId,
      sessionId || null,
      id,
      updateDto,
    );
  }

  @Delete("items/:id")
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Remove item from cart",
    description: "Remove an item from the cart",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiParam({
    name: "id",
    description: "Cart item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiOkResponse({
    description: "Item removed from cart successfully",
    type: CartResponseDto,
  })
  @ApiNotFoundResponse({
    description: "Cart item not found",
  })
  async removeItem(
    @Request() req,
    @Param("id") id: string,
    @Headers("x-session-id") sessionId?: string,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    return this.cartsService.removeItem(userId, sessionId || null, id);
  }

  @Delete()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Clear cart",
    description: "Remove all items from the cart",
  })
  @ApiHeader({
    name: "X-Session-Id",
    description: "Session ID for guest carts (optional if authenticated)",
    required: false,
  })
  @ApiOkResponse({
    description: "Cart cleared successfully",
    type: CartResponseDto,
  })
  async clearCart(
    @Request() req,
    @Headers("x-session-id") sessionId?: string,
  ): Promise<CartResponseDto> {
    const userId = req.user?.id || null;
    return this.cartsService.clearCart(userId, sessionId || null);
  }
}
