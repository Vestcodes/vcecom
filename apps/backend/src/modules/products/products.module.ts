import { Module } from "@nestjs/common";
import { SalesModule } from "../sales/sales.module";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { VariantsController } from "./variants.controller";
import { VariantsService } from "./variants.service";

@Module({
  imports: [SalesModule],
  controllers: [ProductsController, VariantsController],
  providers: [ProductsService, VariantsService],
  exports: [ProductsService, VariantsService],
})
export class ProductsModule {}
