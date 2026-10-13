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

  // CORS restrictivo
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:4200'
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(new GlobalValidationPipe());

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');


  if (process.env.NODE_ENV !== 'production') {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`🔒 CORS origins: ${corsOrigins.join(', ')}`);
  }
}
bootstrap();
