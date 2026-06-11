import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.setGlobalPrefix("api/v1");

  // Helmet: security headers
  // app.use(helmet.default());

  // CORS restrictivo
  // const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['https://0s3mdg2j-4200.use2.devtunnels.ms', 'http://localhost:4200'];
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:4200'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
    })
  )

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`🔒 CORS origins: ${corsOrigins.join(', ')}`);
  }
}
bootstrap();
