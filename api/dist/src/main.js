"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const app_module_1 = require("./app.module");
const prisma_service_1 = require("./prisma/prisma.service");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter());
    app.useWebSocketAdapter(new platform_socket_io_1.IoAdapter(app));
    app.setGlobalPrefix('api');
    const allowedOrigins = new Set([
        'http://localhost:5173',
        'https://nano-dashboard-pi.vercel.app',
        'http://192.168.1.104:5173',
    ]);
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin) {
                callback(null, true);
                return;
            }
            if (allowedOrigins.has(origin)) {
                callback(null, true);
                return;
            }
            if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) {
                callback(null, true);
                return;
            }
            callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('NanoDashboard API')
        .setDescription('Production-ready NestJS backend for auth, users, dashboard, and Binance market data.')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();
    const swaggerDocument = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('docs', app, swaggerDocument, {
        useGlobalPrefix: true,
        jsonDocumentUrl: 'docs-json',
    });
    const configService = app.get(config_1.ConfigService);
    const prismaService = app.get(prisma_service_1.PrismaService);
    const port = configService.get('PORT') ?? 3000;
    await prismaService.enableShutdownHooks(app);
    await app.listen({ port, host: '0.0.0.0' });
}
void bootstrap();
//# sourceMappingURL=main.js.map