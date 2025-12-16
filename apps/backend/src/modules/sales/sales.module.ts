import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SalesScheduler } from "./sales.scheduler";
import { SalesService } from "./sales.service";

@Module({
  controllers: [SalesController],
  providers: [SalesService, SalesScheduler],
  exports: [SalesService],
})
export class SalesModule {}
