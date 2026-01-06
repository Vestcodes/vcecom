// Load .env file FIRST before any other imports
import { resolve } from "node:path";
import { config } from "dotenv";

// Only load from root .env (when compiled, __dirname is apps/backend/dist)
// 3 levels up: dist -> backend -> apps -> ecommerce (root)
const rootEnvPath = resolve(__dirname, "../../../.env");
config({ path: rootEnvPath });

// Also try loading from apps/backend/.env as fallback
const _envResult = config({ path: resolve(__dirname, "../.env") });

import {
  createBootstrapContext,
  getEarlyLogger,
} from "./common/logging/early-logger";
// Initialize OpenTelemetry BEFORE any other imports
import { initializeTracing } from "./common/tracing/tracing.config";

// Get early logger for use before NestJS bootstrap
const earlyLogger = getEarlyLogger();

// Initialize OpenTelemetry tracing only if OTLP endpoint is configured
let tracingSdk: ReturnType<typeof initializeTracing> | null = null;
const otlpEndpoint =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
if (otlpEndpoint) {
  try {
    tracingSdk = initializeTracing();
    if (tracingSdk) {
      earlyLogger.info(
        createBootstrapContext("tracingInit"),
        "OpenTelemetry tracing initialized",
      );
    }
  } catch (error) {
    earlyLogger.warn(
      {
        ...createBootstrapContext("tracingInit"),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      "Failed to initialize OpenTelemetry tracing - continuing without tracing",
    );
    tracingSdk = null;
  }
} else {
  earlyLogger.debug(
    createBootstrapContext("tracingInit"),
    "OpenTelemetry tracing skipped - OTEL_EXPORTER_OTLP_ENDPOINT not set",
  );
}

import type { Server } from "node:http";
// Now import everything else after .env is loaded
import {
  BadRequestException,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import {
  DocumentBuilder,
  SwaggerDocumentOptions,
  SwaggerModule,
} from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { loadConfig } from "./common/config/config.loader";
import {
  CORS_PREFLIGHT_SUCCESS_STATUS,
  SERVER_HEADERS_TIMEOUT_MS,
  SERVER_KEEP_ALIVE_TIMEOUT_MS,
  SERVER_TIMEOUT_MS,
} from "./common/constants";
import {
  BOOTSTRAP_TIMEOUT_MS,
  PROGRESS_LOG_INTERVAL_MS,
} from "./common/constants/timeout.constants";
import { IS_PUBLIC_KEY } from "./common/decorators/public.decorator";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RateLimitGuard } from "./common/guards/rate-limit.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { BuildInfoInterceptor } from "./common/interceptors/build-info.interceptor";
import { RateLimitInterceptor } from "./common/interceptors/rate-limit.interceptor";
import { ContextService } from "./common/logging/context.service";
import { createPinoConfig } from "./common/logging/pino.config";
import { filterSwaggerTags } from "./common/swagger/tag-filter";

// Add process exit listener to detect direct process.exit() calls
const originalExit = process.exit.bind(process);
process.exit = (code?: number | string | null): never => {
  const stack = new Error().stack;
  earlyLogger.fatal(
    {
      ...createBootstrapContext("processExit"),
      exitCode: code,
      stack,
    },
    `process.exit(${code}) called`,
  );
  // Call original exit - it never returns
  originalExit(code);
  // This line is unreachable but needed for type safety
  throw new Error("process.exit should never return");
};

// Setup unhandled rejection and exception handlers
// Use early logger which includes OpenTelemetry trace context
process.on(
  "unhandledRejection",
  (reason: unknown, promise: Promise<unknown>) => {
    const errorContext = {
      ...createBootstrapContext("unhandledRejection"),
      promise: promise.toString(),
    };

    if (reason instanceof Error) {
      earlyLogger.fatal(
        {
          ...errorContext,
          error: {
            name: reason.name,
            message: reason.message,
            stack: reason.stack,
          },
        },
        "Unhandled promise rejection",
      );
    } else {
      earlyLogger.fatal(
        {
          ...errorContext,
          reasonType: typeof reason,
          reasonString: String(reason),
        },
        "Unhandled promise rejection (non-Error)",
      );
    }

    // Give time for logs to flush before exiting
    setImmediate(() => {
      setTimeout(() => {
        earlyLogger.fatal(
          createBootstrapContext("unhandledRejection"),
          "Exiting process due to unhandled rejection",
        );
        process.exit(1);
      }, 500);
    });
  },
);

process.on("uncaughtException", (error: Error) => {
  earlyLogger.fatal(
    {
      ...createBootstrapContext("uncaughtException"),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    },
    "Uncaught exception",
  );

  // Give time for logs to flush before exiting
  setImmediate(() => {
    setTimeout(() => {
      earlyLogger.fatal(
        createBootstrapContext("uncaughtException"),
        "Exiting process due to uncaught exception",
      );
      process.exit(1);
    }, 500);
  });
});

async function bootstrap() {
  const bootstrapStartTime = Date.now();
  earlyLogger.info(
    createBootstrapContext("bootstrapStart"),
    "Starting application bootstrap",
  );

  // Validate environment variables at startup (fail fast if invalid)
  try {
    // Load and validate configuration
    loadConfig();
    earlyLogger.info(
      createBootstrapContext("envValidation"),
      "Environment variables validated successfully",
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { type: typeof error, value: String(error) };

    // Log to console first to ensure visibility even if logger doesn't flush
    console.error("=".repeat(80));
    console.error("FATAL: Environment variable validation failed");
    console.error("=".repeat(80));
    console.error(errorMessage);
    console.error("=".repeat(80));
    console.error("Required environment variables:");
    console.error("  - DATABASE_URL: PostgreSQL connection URL");
    console.error("  - REDIS_URL: Redis connection URL");
    console.error("  - JWT_SECRET: At least 32 characters, not 'change-me-in-production'");
    console.error("=".repeat(80));

    earlyLogger.fatal(
      {
        ...createBootstrapContext("envValidationError"),
        ...errorDetails,
      },
      "Environment variable validation failed - application cannot start",
    );

    // Give time for logs to flush before exiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.exit(1);
  }

  try {
    // Create a root logger instance for startup logging
    const rootLogger = createPinoConfig();

    rootLogger.info(
      {
        ...createBootstrapContext("loggerInit"),
        elapsedMs: Date.now() - bootstrapStartTime,
      },
      "Logger initialized",
    );

    let app: INestApplication | undefined;
    const nestFactoryStartTime = Date.now();
    try {
      rootLogger.info(
        createBootstrapContext("nestFactoryCreate"),
        "Creating NestJS application",
      );

      // Add timeout wrapper to detect hangs during module initialization
      // Temporarily increased to 30s for diagnostics
      let timeoutHandle: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => {
            const elapsed = Date.now() - nestFactoryStartTime;
            rootLogger.error(
              {
                ...createBootstrapContext("nestFactoryTimeout"),
                elapsedMs: elapsed,
                timeoutMs: BOOTSTRAP_TIMEOUT_MS,
                possibleCauses: [
                  "Database connection (check DATABASE_URL and PostgreSQL)",
                  "Redis connection (check REDIS_URL and Redis server)",
                  "External API call (storage providers, etc.)",
                  "File system operation",
                  "Circular dependency resolution",
                ],
              },
              "NestFactory.create timeout - module initialization is blocking",
            );
            reject(
              new Error(
                `NestFactory.create timeout after ${BOOTSTRAP_TIMEOUT_MS}ms - module initialization is blocking. Check which module's onModuleInit() is hanging.`,
              ),
            );
          },
          BOOTSTRAP_TIMEOUT_MS, // Bootstrap timeout (temporarily increased for diagnostics)
        );
      });

      // Set up progress logger BEFORE creating the promise
      // This ensures we can track progress even if the promise hangs
      const startTime = Date.now();
      let progressInterval: NodeJS.Timeout | null = null;

      // Start progress logging immediately
      rootLogger.debug(
        {
          ...createBootstrapContext("progressLoggerStart"),
          startTime,
        },
        "Starting progress logger",
      );
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        rootLogger.debug(
          {
            ...createBootstrapContext("nestFactoryProgress"),
            elapsedMs: elapsed,
          },
          "NestFactory.create still running",
        );
      }, PROGRESS_LOG_INTERVAL_MS); // Log progress at configured interval

      // Ensure interval is cleared on process exit
      const clearProgressLogger = () => {
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
          const elapsed = Date.now() - startTime;
          rootLogger.debug(
            {
              ...createBootstrapContext("progressLoggerCleared"),
              elapsedMs: elapsed,
            },
            "Progress logger cleared",
          );
        }
      };

      // Wrap NestFactory.create in a try-catch to catch any synchronous errors
      let createPromise: Promise<INestApplication>;
      try {
        rootLogger.debug(
          createBootstrapContext("nestFactoryCall"),
          "Calling NestFactory.create() - will initialize all modules",
        );
        createPromise = NestFactory.create(AppModule, {
          rawBody: true, // Enable raw body for webhook signature verification
          logger: false, // Disable NestJS default logger, use only Pino
          abortOnError: false, // Don't call process.exit() on errors - let us handle them
        });

        // Ensure progress logger is cleared and timeout is cancelled when promise resolves or rejects
        createPromise.finally(() => {
          clearProgressLogger();
          // Cancel timeout since we've resolved successfully
          if (timeoutHandle) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
            rootLogger.debug(
              createBootstrapContext("timeoutCancelled"),
              "Timeout cancelled - NestFactory.create completed",
            );
          }
          const elapsed = Date.now() - startTime;
          rootLogger.debug(
            {
              ...createBootstrapContext("nestFactoryResolved"),
              elapsedMs: elapsed,
            },
            "NestFactory.create promise resolved/rejected",
          );
        });

        rootLogger.debug(
          createBootstrapContext("nestFactoryPromiseCreated"),
          "NestFactory.create promise created successfully",
        );
      } catch (syncError) {
        clearProgressLogger();
        // Cancel timeout on synchronous error
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }
        rootLogger.error(
          {
            ...createBootstrapContext("nestFactorySyncError"),
            error:
              syncError instanceof Error
                ? {
                    name: syncError.name,
                    message: syncError.message,
                    stack: syncError.stack,
                  }
                : { type: typeof syncError, value: String(syncError) },
          },
          "Synchronous error during NestFactory.create",
        );
        throw syncError;
      }

      // Add error handlers to the create promise to catch rejections immediately
      createPromise.catch((error) => {
        rootLogger.error(
          {
            ...createBootstrapContext("createPromiseRejected"),
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : { type: typeof error, value: String(error) },
          },
          "CreatePromise rejected",
        );
        // Don't rethrow - let Promise.race handle it
      });

      // Also add error handler to timeout promise
      timeoutPromise.catch((error) => {
        rootLogger.error(
          {
            ...createBootstrapContext("timeoutPromiseRejected"),
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : { type: typeof error, value: String(error) },
          },
          "TimeoutPromise rejected",
        );
      });

      // Add promise state tracking
      let createPromiseResolved = false;
      let timeoutPromiseResolved = false;

      createPromise
        .then(() => {
          createPromiseResolved = true;
          rootLogger.debug(
            createBootstrapContext("createPromiseResolved"),
            "CreatePromise resolved successfully",
          );
        })
        .catch((err) => {
          rootLogger.error(
            {
              ...createBootstrapContext("createPromiseRejected"),
              error:
                err instanceof Error
                  ? {
                      name: err.name,
                      message: err.message,
                      stack: err.stack,
                    }
                  : { type: typeof err, value: String(err) },
            },
            "CreatePromise rejected",
          );
        });

      timeoutPromise.catch(() => {
        timeoutPromiseResolved = true;
        rootLogger.debug(
          createBootstrapContext("timeoutPromiseTriggered"),
          "TimeoutPromise triggered",
        );
      });

      // Wrap in additional try-catch with more detailed logging
      try {
        rootLogger.debug(
          createBootstrapContext("promiseRaceStart"),
          "Starting Promise.race - monitoring both createPromise and timeoutPromise",
        );
        app = await Promise.race([createPromise, timeoutPromise]);
        const elapsed = Date.now() - startTime;
        rootLogger.info(
          {
            ...createBootstrapContext("promiseRaceCompleted"),
            elapsedMs: elapsed,
            createPromiseResolved,
            timeoutPromiseResolved,
          },
          "Promise.race completed successfully",
        );
        // Ensure timeout is cancelled if createPromise won
        if (createPromiseResolved && timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
          rootLogger.debug(
            createBootstrapContext("timeoutCancelledAfterResolution"),
            "Timeout cancelled after successful resolution",
          );
        }
      } catch (raceError) {
        rootLogger.error(
          {
            ...createBootstrapContext("promiseRaceError"),
            error:
              raceError instanceof Error
                ? {
                    name: raceError.name,
                    message: raceError.message,
                    stack: raceError.stack,
                  }
                : { type: typeof raceError, value: String(raceError) },
          },
          "Promise.race threw error",
        );
        throw raceError;
      }

      rootLogger.info(
        {
          ...createBootstrapContext("nestFactorySuccess"),
          elapsedMs: Date.now() - nestFactoryStartTime,
        },
        "NestJS application created successfully",
      );
    } catch (error) {
      rootLogger.error(
        {
          ...createBootstrapContext("nestFactoryError"),
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                  isTimeout: error.message.includes("timeout"),
                  errorType: error.message.includes("timeout")
                    ? "TIMEOUT"
                    : "NESTJS_ERROR",
                }
              : { type: typeof error, value: String(error) },
        },
        "Failed to create NestJS application",
      );
      throw error;
    }

    const reflector = app.get(Reflector);

    // Enable CORS
    // Support storefront, admin, and backend origins
    const storefrontUrl = process.env.STOREFRONT_URL || "http://localhost:3002";
    const adminUrl = process.env.ADMIN_URL || "http://localhost:3000";
    const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

    // Combine all allowed origins (support comma-separated values for multiple URLs)
    const allowedOrigins = [
      ...storefrontUrl.split(",").map((url) => url.trim()),
      ...adminUrl.split(",").map((url) => url.trim()),
      ...backendUrl.split(",").map((url) => url.trim()),
      ...(process.env.ALLOWED_ORIGINS?.split(",").map((url) => url.trim()) ||
        []),
    ];

    // Enable cookie parser
    app.use(cookieParser());

    // Configure request body size limits (10MB) to prevent DoS attacks
    app.use(json({ limit: "10mb" }));
    app.use(urlencoded({ limit: "10mb", extended: true }));

    // Configure security headers with Helmet
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        hsts: {
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
        frameguard: {
          action: "deny",
        },
        noSniff: true,
        xssFilter: true,
        referrerPolicy: {
          policy: "strict-origin-when-cross-origin",
        },
      }),
    );

    app.enableCors({
      origin: (origin, callback) => {
        // In production, reject requests without origin header for security
        // In development, allow requests without origin (like mobile apps or curl requests)
        const isProduction = process.env.NODE_ENV === "production";
        if (!origin) {
          if (isProduction) {
            return callback(new Error("Origin header required in production"));
          }
          return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Session-Id",
        "X-Store-ID",
      ],
      preflightContinue: false,
      optionsSuccessStatus: CORS_PREFLIGHT_SUCCESS_STATUS,
    });

    // Enable validation globally
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        exceptionFactory: (errors) => {
          const messages = errors.map((error) => {
            const constraints = error.constraints
              ? Object.values(error.constraints).join(", ")
              : `${error.property} has invalid value`;
            return `${error.property}: ${constraints}`;
          });
          return new BadRequestException({
            message: "Validation failed",
            errors: messages,
            details: errors,
          });
        },
      }),
    );

    // Create custom JWT guard that respects @Public() decorator
    const jwtGuard = new JwtAuthGuard();
    const rolesGuard = new RolesGuard(reflector);

    // Override JWT guard to skip public routes
    const originalCanActivate = jwtGuard.canActivate.bind(jwtGuard);
    jwtGuard.canActivate = async (context: ExecutionContext) => {
      const isPublic = reflector.getAllAndOverride(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) as boolean | undefined;
      if (isPublic) {
        return true;
      }
      return originalCanActivate(context);
    };

    // Get rate limit guard and interceptor
    // Note: These are retrieved from the app container after NestFactory.create()
    // which ensures all modules are initialized
    let rateLimitGuard: RateLimitGuard;
    let rateLimitInterceptor: RateLimitInterceptor;
    try {
      rateLimitGuard = app.get(RateLimitGuard, { strict: false });
      rateLimitInterceptor = app.get(RateLimitInterceptor, { strict: false });
      if (!rateLimitGuard || !rateLimitInterceptor) {
        rootLogger.warn(
          "Rate limiting components not found, continuing without rate limiting",
        );
        // Create no-op implementations
        rateLimitGuard = {
          canActivate: () => Promise.resolve(true),
        } as unknown as RateLimitGuard;
        rateLimitInterceptor = {
          intercept: (context, next) => next.handle(),
        } as unknown as RateLimitInterceptor;
      }
    } catch (error) {
      rootLogger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        "Failed to initialize rate limiting, continuing without it",
      );
      // Create no-op implementations
      rateLimitGuard = {
        canActivate: () => Promise.resolve(true),
      } as unknown as RateLimitGuard;
      rateLimitInterceptor = {
        intercept: (context, next) => next.handle(),
      } as unknown as RateLimitInterceptor;
    }

    // Apply guards globally
    app.useGlobalGuards(jwtGuard, rolesGuard, rateLimitGuard);

    // Apply interceptors globally
    app.useGlobalInterceptors(new BuildInfoInterceptor(), rateLimitInterceptor);

    // Apply global exception filter
    const contextService = app.get(ContextService);
    app.useGlobalFilters(new GlobalExceptionFilter(contextService));

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
      .addTag("admin", "Admin dashboard endpoints")
      .addTag("store", "Storefront API endpoints")
      .build();

    // Disable auto-tag generation from controller names
    const swaggerOptions: SwaggerDocumentOptions = {
      autoTagControllers: false,
    };

    const document = SwaggerModule.createDocument(app, config, swaggerOptions);

    // Filter document to only include "admin" and "store" tags
    const filteredDocument = filterSwaggerTags(document);

    SwaggerModule.setup("api/docs", app, filteredDocument, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    const port = process.env.PORT ?? 3001;
    const serverStartTime = Date.now();
    rootLogger.info(
      {
        ...createBootstrapContext("serverStart"),
        port,
      },
      "Starting HTTP server",
    );

    let server: Server;
    try {
      server = (await app.listen(port)) as Server;
      rootLogger.info(
        {
          ...createBootstrapContext("serverStarted"),
          port,
          elapsedMs: Date.now() - serverStartTime,
        },
        "HTTP server started successfully",
      );
    } catch (error) {
      rootLogger.error(
        {
          ...createBootstrapContext("serverStartError"),
          error:
            error instanceof Error
              ? {
                  name: error.name,
                  message: error.message,
                  stack: error.stack,
                }
              : { type: typeof error, value: String(error) },
          port,
        },
        "Failed to start HTTP server",
      );
      throw error;
    }

    // Set server timeout to prevent hanging requests
    // This ensures requests are closed after the configured timeout period
    server.timeout = SERVER_TIMEOUT_MS;
    server.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT_MS;
    server.headersTimeout = SERVER_HEADERS_TIMEOUT_MS;

    rootLogger.info(
      {
        ...createBootstrapContext("serverInitialized"),
        port,
        elapsedMs: Date.now() - bootstrapStartTime,
        timeouts: {
          server: SERVER_TIMEOUT_MS,
          keepAlive: SERVER_KEEP_ALIVE_TIMEOUT_MS,
          headers: SERVER_HEADERS_TIMEOUT_MS,
        },
      },
      "Server fully initialized and listening",
    );

    // Ensure server keeps event loop alive
    // The HTTP server should already do this, but we'll verify
    if (!server.listening) {
      rootLogger.error(
        createBootstrapContext("serverNotListening"),
        "Server is not listening - this should not happen",
      );
      throw new Error("Server is not listening - this should not happen");
    }

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      const shutdownStartTime = Date.now();
      rootLogger.info(
        {
          ...createBootstrapContext("shutdownStart"),
          signal,
        },
        "Received shutdown signal, starting graceful shutdown",
      );

      try {
        // Close HTTP server first to stop accepting new requests
        server.close(() => {
          rootLogger.info(
            {
              ...createBootstrapContext("serverClosed"),
              signal,
              elapsedMs: Date.now() - shutdownStartTime,
            },
            "HTTP server closed",
          );
        });

        // Shutdown tracing
        if (tracingSdk) {
          await tracingSdk.shutdown();
          rootLogger.info(
            {
              ...createBootstrapContext("tracingShutdown"),
              signal,
              elapsedMs: Date.now() - shutdownStartTime,
            },
            "Tracing SDK shut down",
          );
        }

        // Close NestJS application (this triggers OnApplicationShutdown hooks)
        // Database cleanup will happen via DatabaseService.onApplicationShutdown
        await app.close();
        rootLogger.info(
          {
            ...createBootstrapContext("applicationClosed"),
            signal,
            elapsedMs: Date.now() - shutdownStartTime,
          },
          "Application closed successfully",
        );
      } catch (error) {
        rootLogger.error(
          {
            ...createBootstrapContext("shutdownError"),
            error:
              error instanceof Error
                ? {
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                  }
                : { type: typeof error, value: String(error) },
            signal,
            elapsedMs: Date.now() - shutdownStartTime,
          },
          "Error during shutdown",
        );
        process.exit(1);
      }
    };

    // Handle SIGTERM (used by process managers like PM2, Docker, Kubernetes)
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Handle SIGINT (Ctrl+C)
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    // Use earlyLogger since rootLogger might not be initialized
    earlyLogger.error(
      {
        ...createBootstrapContext("bootstrapError"),
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : { type: typeof error, value: String(error) },
        elapsedMs: Date.now() - bootstrapStartTime,
      },
      "Caught error in bootstrap try-catch",
    );
    // Give time for logs to flush
    setTimeout(() => {
      earlyLogger.fatal(
        createBootstrapContext("bootstrapExit"),
        "Exiting process due to bootstrap error",
      );
      process.exit(1);
    }, 200);
  }
}

// Wrap bootstrap in try-catch and add detailed error logging
bootstrap().catch((error) => {
  earlyLogger.fatal(
    {
      ...createBootstrapContext("bootstrapPromiseRejection"),
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { type: typeof error, value: String(error) },
    },
    "Bootstrap promise rejection",
  );
  // Give time for logs to flush
  setTimeout(() => {
    earlyLogger.fatal(
      createBootstrapContext("bootstrapPromiseExit"),
      "Exiting process due to bootstrap promise rejection",
    );
    process.exit(1);
  }, 200);
});
