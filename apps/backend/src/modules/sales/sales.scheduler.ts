import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SalesService } from "./sales.service";

@Injectable()
export class SalesScheduler {
  private readonly logger = new Logger(SalesScheduler.name);

  constructor(private readonly salesService: SalesService) {}

  /**
   * Update sale statuses every 5 minutes
   * This ensures that scheduled sales become active and expired sales are marked as expired
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateSaleStatuses() {
    this.logger.log("Running scheduled sale status update...");
    try {
      await this.salesService.updateSaleStatuses();
      this.logger.log("Sale status update completed successfully");
    } catch (error) {
      this.logger.error(
        `Failed to update sale statuses: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
