// Load .env file FIRST before any other imports
import { resolve } from "node:path";
import { config } from "dotenv";

// Only load from root .env (when compiled, __dirname is apps/backend/dist)
// 3 levels up: dist -> backend -> apps -> ecommerce (root)
const rootEnvPath = resolve(__dirname, "../../../.env");
config({ path: rootEnvPath });

// Now import everything else after .env is loaded
import { ExecutionContext } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

import { IS_PUBLIC_KEY } from "./common/decorators/public.decorator";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { BuildInfoInterceptor } from "./common/interceptors/build-info.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
  });
  const reflector = app.get(Reflector);

  // Enable CORS
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",")
    : ["http://localhost:3000"];

  // Enable cookie parser
  app.use(cookieParser());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Enable validation globally
  app.useGlobalPipes(
    new (await import("@nestjs/common")).ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Create custom JWT guard that respects @Public() decorator
  const jwtGuard = new JwtAuthGuard();
  const rolesGuard = new RolesGuard(reflector);

  // Override JWT guard to skip public routes
  const originalCanActivate = jwtGuard.canActivate.bind(jwtGuard);
  jwtGuard.canActivate = async (context: ExecutionContext) => {
    const isPublic = reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return originalCanActivate(context);
  };

  // Apply guards globally
  app.useGlobalGuards(jwtGuard, rolesGuard);

  // Apply interceptors globally
  app.useGlobalInterceptors(new BuildInfoInterceptor());

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle("VCEcom API")
    .setDescription(
      "API documentation for VCEcom - A lightweight ecommerce backend built with NestJS",
    )
    .setVersion("0.0.1")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "JWT-auth",
    )
    .addTag("auth", "Authentication endpoints")
    .addTag("categories", "Category management endpoints")
    .addTag("products", "Product management endpoints")
    .addTag("product-variants", "Product variant management endpoints")
    .addTag("customers", "Customer management endpoints")
    .addTag("carts", "Shopping cart endpoints")
    .addTag("orders", "Order management endpoints")
    .addTag("payments", "Payment processing endpoints")
    .addTag("shipping", "Shipping integration endpoints")
    .addTag("admin", "Admin dashboard endpoints")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.BACKEND_PORT ?? 3001);
  console.log(`Backend is running on port ${process.env.BACKEND_PORT ?? 3001}`);
}
bootstrap();
