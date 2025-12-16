import { Module } from "@nestjs/common";
import { DiscountsModule } from "../discounts/discounts.module";
import { SalesModule } from "../sales/sales.module";
import { CartsController } from "./carts.controller";
import { CartsService } from "./carts.service";

@Module({
  imports: [DiscountsModule, SalesModule],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {}
