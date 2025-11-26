import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      "admin" | "customer"
    >("roles", [context.getHandler(), context.getClass()]);

    // If no roles are required, allow access
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user (not authenticated), throw 401
    if (!user) {
      throw new UnauthorizedException(
        "Authentication required. Please provide a valid JWT token.",
      );
    }

    // If user role doesn't match required role, throw 403
    if (user.role !== requiredRoles) {
      throw new ForbiddenException(
        `Access denied. This endpoint requires ${requiredRoles} role, but you have ${user.role} role.`,
      );
    }

    return true;
  }
}
