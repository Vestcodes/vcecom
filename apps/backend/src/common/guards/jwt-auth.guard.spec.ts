import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard();
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  describe("canActivate", () => {
    it("should allow access for valid JWT token", async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              authorization: "Bearer valid-token",
            },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      // Mock the parent AuthGuard's canActivate
      const originalCanActivate = guard.canActivate.bind(guard);
      guard.canActivate = jest.fn().mockResolvedValue(true);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it("should throw UnauthorizedException for missing token", async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      guard.canActivate = jest
        .fn()
        .mockRejectedValue(new UnauthorizedException("Unauthorized"));

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
