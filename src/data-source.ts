import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'iriguchi.proxy.rlwy.net',
        port: Number(process.env.DB_PORT) || 26753,
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD?.toString() || 'XVSGYXqAauYwCBofVSPFsbmJgKaSJLvb',
        database: process.env.DB_DATABASE || 'railway',
      }),
  entities: [__dirname + '/**/*.entity{.ts,.js}', __dirname + '/**/*-entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});

