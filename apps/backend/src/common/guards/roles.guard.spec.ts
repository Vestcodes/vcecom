import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should allow access when no roles are required", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: "123", email: "test@example.com", role: "customer" },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it("should allow access when user role matches required role (admin)", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue("admin");

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: "123", email: "admin@example.com", role: "admin" },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it("should allow access when user role matches required role (customer)", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue("customer");

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: "123",
              email: "customer@example.com",
              role: "customer",
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it("should throw UnauthorizedException when user is not authenticated", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue("admin");

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
      expect(() => guard.canActivate(mockContext)).toThrow(
        "Authentication required",
      );
    });

    it("should throw ForbiddenException when user role doesn't match (customer accessing admin route)", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue("admin");

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: "123",
              email: "customer@example.com",
              role: "customer",
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        "Access denied. This endpoint requires admin role",
      );
    });

    it("should throw ForbiddenException when user role doesn't match (admin accessing customer route)", () => {
      jest.spyOn(reflector, "getAllAndOverride").mockReturnValue("customer");

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: "123",
              email: "admin@example.com",
              role: "admin",
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        "Access denied. This endpoint requires customer role",
      );
    });
  });
});
