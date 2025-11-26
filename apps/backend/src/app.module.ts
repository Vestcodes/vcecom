import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { CategoriesModule } from "./modules/categories/categories.module";

@Module({
  imports: [AuthModule, CategoriesModule],
  controllers: [AppController],
})
export class AppModule {}
