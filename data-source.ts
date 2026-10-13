import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource(
  process.env.DATABASE_URL
    ? {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: ['src/**/*.entity.ts', 'src/**/*-entity.ts'],
        migrations: ['src/migrations/*.ts'],
        synchronize: false,
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
        port: Number(process.env.DB_PORT || process.env.PGPORT) || 5432,
        username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
        database: process.env.DB_DATABASE || process.env.PGDATABASE || 'finance_tejo',
        entities: ['src/**/*.entity.ts', 'src/**/*-entity.ts'],
        migrations: ['src/migrations/*.ts'],
        synchronize: false,
      },
);
