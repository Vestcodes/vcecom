import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("register", () => {
    it("should register a new user", async () => {
      const registerDto = {
        email: "test@example.com",
        password: "password123",
        role: "customer" as const,
      };

      const mockResponse = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
      };

      mockAuthService.register.mockResolvedValue(mockResponse);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(
        registerDto.email,
        registerDto.password,
        registerDto.role,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw BadRequestException if user already exists", async () => {
      const registerDto = {
        email: "existing@example.com",
        password: "password123",
      };

      mockAuthService.register.mockRejectedValue(
        new BadRequestException("User already exists"),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("login", () => {
    it("should login user and return tokens", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "password123",
      };

      const mockUser = {
        id: "123",
        email: "test@example.com",
        role: "customer",
      };

      const mockResponse = {
        access_token: "mock-access-token",
        refresh_token: "mock-refresh-token",
      };

      mockAuthService.validateUser.mockResolvedValue(mockUser);
      mockAuthService.login.mockReturnValue(mockResponse);

      const result = await controller.login(loginDto);

      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password,
      );
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockResponse);
    });

    it("should throw UnauthorizedException for invalid credentials", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      mockAuthService.validateUser.mockRejectedValue(
        new UnauthorizedException("Invalid credentials"),
      );

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("refresh", () => {
    it("should refresh tokens", async () => {
      const refreshTokenDto = {
        refresh_token: "valid-refresh-token",
      };

      const mockResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
      };

      mockAuthService.refreshToken.mockResolvedValue(mockResponse);

      const result = await controller.refresh(refreshTokenDto);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        refreshTokenDto.refresh_token,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should throw UnauthorizedException for invalid refresh token", async () => {
      const refreshTokenDto = {
        refresh_token: "invalid-refresh-token",
      };

      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException("Invalid refresh token"),
      );

      await expect(controller.refresh(refreshTokenDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
