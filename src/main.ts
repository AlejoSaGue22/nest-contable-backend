import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });


  app.setGlobalPrefix('api/v1');

  // Helmet: security headers
  // app.use(helmet.default());

  // CORS restrictivo
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://192.168.1.77:4200',
    'http://localhost:4200',
    'http://192.168.1.15:4200'
  ];
  // const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
  //   'http://localhost:4200',
  // ];
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
      transform: true,
    }),
  );

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  // await app.listen(port);
  await app.listen(3000, '0.0.0.0');


  if (process.env.NODE_ENV !== 'production') {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`🔒 CORS origins: ${corsOrigins.join(', ')}`);
  }
}
bootstrap();
