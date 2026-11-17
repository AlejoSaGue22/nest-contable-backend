import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalValidationPipe } from './common/validation/global-validation.pipe';
import * as express from 'express';
import { join } from 'path';
import * as helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Serve static uploads
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  app.setGlobalPrefix('api/v1');

  // Helmet: security headers
  app.use(helmet.default());

  // CORS configuration
  const rawOrigins = process.env.CORS_ORIGINS || 'http://localhost:4200';
  const corsOrigins = rawOrigins
    .split(',')
    .map((originStr) => {
      const trimmed = originStr.trim();
      if (!trimmed) return null;
      try {
        return new URL(trimmed).origin;
      } catch {
        return trimmed.replace(/\/+$/, '');
      }
    })
    .filter(Boolean) as string[];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  app.useGlobalPipes(new GlobalValidationPipe());

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Server running on port ${port}`);
  console.log(`🔒 Allowed CORS origins: ${corsOrigins.join(', ')}`);
}
bootstrap();
