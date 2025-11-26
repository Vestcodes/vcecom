import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { db, eq, users } from "@vcecom/db";
import * as bcrypt from "bcrypt";
import { AuthService } from "./auth.service";

// Mock dependencies
jest.mock("@vcecom/db", () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
  },
  eq: jest.fn(),
  users: {},
}));

jest.mock("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockBcrypt.compare.mockReset();
    mockBcrypt.hash.mockReset();
  });

  describe("validateUser", () => {
    it("should throw UnauthorizedException if user not found", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      (db.select as jest.Mock) = mockSelect;

      await expect(
        service.validateUser("test@example.com", "password123"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if password is invalid", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        passwordHash: "hashedPassword",
      };

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      (db.select as jest.Mock) = mockSelect;
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.validateUser("test@example.com", "wrongpassword"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should return user if credentials are valid", async () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        passwordHash: "hashedPassword",
        role: "customer",
      };

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      (db.select as jest.Mock) = mockSelect;
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await service.validateUser(
        "test@example.com",
        "password123",
      );

      expect(result).toEqual(mockUser);
    });
  });

  describe("register", () => {
    it("should throw BadRequestException for invalid email format", async () => {
      await expect(
        service.register("invalid-email", "password123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if user already exists", async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: "123" }]),
          }),
        }),
      });

      (db.select as jest.Mock) = mockSelect;

      await expect(
        service.register("existing@example.com", "password123"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should create user and return tokens", async () => {
      const mockNewUser = {
        id: "123",
        email: "new@example.com",
        role: "customer",
      };

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      const mockInsert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([mockNewUser]),
        }),
      });

      (db.select as jest.Mock) = mockSelect;
      (db.insert as jest.Mock) = mockInsert;
      mockBcrypt.hash.mockResolvedValue("hashedPassword");
      (jwtService.sign as jest.Mock) = jest.fn().mockReturnValue("mock-token");

      const result = await service.register("new@example.com", "password123");

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
    });
  });

  describe("login", () => {
    it("should return access token and refresh token", () => {
      const mockUser = {
        id: "123",
        email: "test@example.com",
        role: "customer",
      };

      (jwtService.sign as jest.Mock) = jest.fn().mockReturnValue("mock-token");

      const result = service.login(mockUser);

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe("refreshToken", () => {
    it("should throw UnauthorizedException for invalid token", async () => {
      (jwtService.verify as jest.Mock) = jest.fn().mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(service.refreshToken("invalid-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if user not found", async () => {
      const mockPayload = { sub: "123", email: "test@example.com" };

      (jwtService.verify as jest.Mock) = jest.fn().mockReturnValue(mockPayload);

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      (db.select as jest.Mock) = mockSelect;

      await expect(service.refreshToken("valid-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should return new tokens for valid refresh token", async () => {
      const mockPayload = {
        sub: "123",
        email: "test@example.com",
        role: "customer",
      };
      const mockUser = {
        id: "123",
        email: "test@example.com",
        role: "customer",
      };

      (jwtService.verify as jest.Mock) = jest.fn().mockReturnValue(mockPayload);
      (jwtService.sign as jest.Mock) = jest.fn().mockReturnValue("new-token");

      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([mockUser]),
          }),
        }),
      });

      (db.select as jest.Mock) = mockSelect;

      const result = await service.refreshToken("valid-refresh-token");

      expect(result).toHaveProperty("access_token");
      expect(result).toHaveProperty("refresh_token");
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });
  });
});
