import { Module } from '@nestjs/common';
import { ClientesModule } from './clientes/clientes.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosModule } from './productos/productos.module';
import { AuthModule } from './auth/auth.module';
import { FacturasVentasModule } from './facturas-ventas/facturas-ventas.module';

@Module({
  imports: [TypeOrmModule.forRoot({
                type: 'mysql',
                host: 'localhost',
                port: 3306,
                username: 'root',
                // username: 'admin_engim',
                // password: '200122',
                password: '',
                database: 'finance_tejo',
                autoLoadEntities: true,
                synchronize: true
            }),
           ClientesModule,
           ProductosModule,
           UsersModule,
           AuthModule,
           FacturasVentasModule],
  controllers: [],
})

export class AppModule {}
