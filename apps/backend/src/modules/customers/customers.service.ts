import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { customers, db, eq, users } from "@vcecom/db";
import * as bcrypt from "bcrypt";
import {
  formatGstin,
  isValidGstinFormat,
} from "../../common/utils/gstin.utils";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class CustomersService {
  constructor(private jwtService: JwtService) {}

  /**
   * Register a new customer
   * Creates both user (for authentication) and customer (for profile) records
   */
  async register(registerDto: RegisterCustomerDto) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(registerDto.email)) {
      throw new BadRequestException("Invalid email format");
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, registerDto.email))
      .limit(1);

    if (existingUser) {
      throw new BadRequestException("User with this email already exists");
    }

    // Check if customer with phone already exists
    const [existingCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, registerDto.phone))
      .limit(1);

    if (existingCustomer) {
      throw new BadRequestException(
        "Customer with this phone number already exists",
      );
    }

    // Validate GSTIN if provided
    if (registerDto.gstin) {
      const formattedGstin = formatGstin(registerDto.gstin);
      if (!isValidGstinFormat(formattedGstin)) {
        throw new BadRequestException(
          "Invalid GSTIN format. GSTIN must be 15 characters: 2 digits (state) + 10 alphanumeric (PAN) + 1 digit (entity) + 1 letter + 1 digit (check)",
        );
      }

      // Check if GSTIN already exists
      const [existingGstin] = await db
        .select()
        .from(customers)
        .where(eq(customers.gstin, formattedGstin))
        .limit(1);

      if (existingGstin) {
        throw new BadRequestException(
          "Customer with this GSTIN already exists",
        );
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // Create user first
    const [newUser] = await db
      .insert(users)
      .values({
        email: registerDto.email,
        passwordHash,
        role: "customer",
      })
      .returning();

    if (!newUser) {
      throw new BadRequestException("Failed to create user");
    }

    // Create customer profile
    const [newCustomer] = await db
      .insert(customers)
      .values({
        userId: newUser.id,
        email: registerDto.email,
        phone: registerDto.phone,
        name: registerDto.name,
        gstin: registerDto.gstin ? formatGstin(registerDto.gstin) : null,
      })
      .returning();

    if (!newCustomer) {
      // Rollback: delete user if customer creation fails
      await db.delete(users).where(eq(users.id, newUser.id));
      throw new BadRequestException("Failed to create customer profile");
    }

    // Generate tokens
    const payload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || "change-me-in-production",
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret:
        process.env.JWT_REFRESH_SECRET || "change-me-refresh-in-production",
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      customer: newCustomer,
    };
  }

  /**
   * Get customer profile by user ID
   */
  async getProfile(userId: string) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    if (!customer) {
      throw new NotFoundException("Customer profile not found");
    }

    return customer;
  }

  /**
   * Update customer profile
   */
  async updateProfile(userId: string, updateDto: UpdateProfileDto) {
    // Get existing customer
    const [existingCustomer] = await db
      .select()
      .from(customers)
      .where(eq(customers.userId, userId))
      .limit(1);

    if (!existingCustomer) {
      throw new NotFoundException("Customer profile not found");
    }

    // Validate phone uniqueness if phone is being updated
    if (updateDto.phone && updateDto.phone !== existingCustomer.phone) {
      const [existingPhone] = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, updateDto.phone))
        .limit(1);

      if (existingPhone) {
        throw new BadRequestException(
          "Customer with this phone number already exists",
        );
      }
    }

    // Validate GSTIN if provided
    if (updateDto.gstin !== undefined) {
      if (updateDto.gstin) {
        const formattedGstin = formatGstin(updateDto.gstin);
        if (!isValidGstinFormat(formattedGstin)) {
          throw new BadRequestException(
            "Invalid GSTIN format. GSTIN must be 15 characters: 2 digits (state) + 10 alphanumeric (PAN) + 1 digit (entity) + 1 letter + 1 digit (check)",
          );
        }

        // Check if GSTIN already exists (excluding current customer)
        const [existingGstin] = await db
          .select()
          .from(customers)
          .where(eq(customers.gstin, formattedGstin))
          .limit(1);

        if (existingGstin && existingGstin.id !== existingCustomer.id) {
          throw new BadRequestException(
            "Customer with this GSTIN already exists",
          );
        }
      }
    }

    // Build update data
    const updateData: Partial<typeof customers.$inferInsert> = {};
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone;
    if (updateDto.gstin !== undefined) {
      updateData.gstin = updateDto.gstin ? formatGstin(updateDto.gstin) : null;
    }

    // Update customer
    const [updated] = await db
      .update(customers)
      .set(updateData)
      .where(eq(customers.userId, userId))
      .returning();

    return updated;
  }

  /**
   * Change customer password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(
      changePasswordDto.newPassword,
      10,
    );

    // Update password
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(users.id, userId));

    return { message: "Password changed successfully" };
  }
}
