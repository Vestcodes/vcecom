import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ProductsModule } from "./modules/products/products.module";

@Module({
  imports: [AuthModule, CategoriesModule, ProductsModule],
  controllers: [AppController],
})
export class AppModule {}
