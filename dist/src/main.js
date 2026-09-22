"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = require("helmet");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./core/errors/http-exception.filter");
const transform_response_interceptor_1 = require("./core/response/transform-response.interceptor");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.use((0, helmet_1.default)());
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    const apiPrefix = process.env.API_PREFIX || 'api/v1';
    app.setGlobalPrefix(apiPrefix);
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    const reflector = app.get(core_1.Reflector);
    app.useGlobalInterceptors(new transform_response_interceptor_1.TransformResponseInterceptor(reflector));
    app.useGlobalFilters(new http_exception_filter_1.GlobalExceptionFilter());
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('DORI-TN V3 — API Documentation')
        .setDescription("Spécification fonctionnelle et technique du système de gestion de files d'attente et de rendez-vous DORI-TN V3.")
        .setVersion('3.0.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('api/docs', app, document, {
        customSiteTitle: 'DORI-TN V3 — API Docs',
        swaggerOptions: {
            urls: [
                { url: '/api/docs-json', name: 'JSON' },
                { url: '/api/docs-yaml', name: 'YAML' },
            ],
            displayRequestDuration: true,
            persistAuthorization: true,
        },
        customCss: `
      .swagger-ui .topbar-wrapper::after {
        content: '';
      }
      .download-links {
        display: flex;
        gap: 8px;
        padding: 4px 12px;
        align-items: center;
      }
    `,
        customfavIcon: '',
        customJs: '',
        jsonDocumentUrl: 'api/docs-json',
        yamlDocumentUrl: 'api/docs-yaml',
    });
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`🚀 Serveur DORI-TN V3 démarré sur http://localhost:${port}/${apiPrefix}`);
    logger.log(`📚 Documentation Swagger disponible sur http://localhost:${port}/api/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map