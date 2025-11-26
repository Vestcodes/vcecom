import { ExecutionContext } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { IS_PUBLIC_KEY } from "./common/decorators/public.decorator";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const reflector = app.get(Reflector);

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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
