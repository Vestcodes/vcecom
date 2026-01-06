import {
  BadRequestException,
  Injectable,
  NestMiddleware,
} from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { StoreContextService } from "../store-context/store-context.service";

/**
 * Middleware to extract and validate store context from request headers
 * Sets store context in request object and AsyncLocalStorage for use in controllers/services
 */
@Injectable()
export class StoreContextMiddleware implements NestMiddleware {
  constructor(private readonly storeContextService: StoreContextService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract store ID from header
      const storeIdHeader = req.headers["x-store-id"] as string | undefined;
      const storeId =
        this.storeContextService.extractStoreIdFromHeader(storeIdHeader);

      // BETA FEATURE: Multi-store support is opt-in via X-Store-ID header
      // If no store ID provided, skip store context (backward compatible)
      // Existing functionality continues to work without store context
      if (!storeId) {
        // No store context - backward compatible mode
        // Services will use default store or handle null storeId gracefully
        next();
        return;
      }

      // Validate store exists if header is provided
      const isValid = await this.storeContextService.validateStore(storeId);
      if (!isValid) {
        throw new BadRequestException(`Invalid store ID: ${storeId}`);
      }

      // Get store details and set context
      const storeContext = await this.storeContextService.getStore(storeId);
      if (!storeContext) {
        throw new BadRequestException(`Store not found: ${storeId}`);
      }

      // Set store context in request object (for controllers/decorators)
      req.storeContext = storeContext;

      // Run the rest of the request within the store context (for services)
      // This allows services to access store context via StoreContextService.getStoreId()
      // AsyncLocalStorage will propagate context through all async operations
      this.storeContextService.run(storeContext, () => {
        next();
      });
    } catch (error) {
      next(error);
    }
  }
}
