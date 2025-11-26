import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
      },
    }),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
