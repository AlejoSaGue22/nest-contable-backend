import { Module } from '@nestjs/common';
import { ClientesModule } from './clientes/clientes.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosModule } from './productos/productos.module';
import { AuthModule } from './auth/auth.module';
import { FacturasVentasModule } from './facturas-ventas/facturas-ventas.module';
import { RolesModule } from './roles/roles.module';
import { MenuModule } from './menu/menu.module';

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
           FacturasVentasModule,
           RolesModule,
           MenuModule],
  controllers: [],
})

export class AppModule {}

// app.module.ts

// @Module({
//   imports: [
//     ConfigModule.forRoot({
//       isGlobal: true,
//     }),
//     TypeOrmModule.forRootAsync({
//       imports: [ConfigModule],
//       useFactory: (configService: ConfigService) => ({
//         type: 'postgres',
//         host: configService.get('DB_HOST'),
//         port: configService.get('DB_PORT'),
//         username: configService.get('DB_USERNAME'),
//         password: configService.get('DB_PASSWORD'),
//         database: configService.get('DB_NAME'),
//         entities: [__dirname + '/**/*.entity{.ts,.js}'],
//         synchronize: configService.get('NODE_ENV') !== 'production',
//         logging: configService.get('NODE_ENV') === 'development',
//       }),
//       inject: [ConfigService],
//     }),
//     JwtModule.registerAsync({
//       imports: [ConfigModule],
//       useFactory: (configService: ConfigService) => ({
//         secret: configService.get('JWT_SECRET'),
//         signOptions: {
//           expiresIn: configService.get('JWT_EXPIRES_IN', '1d'),
//         },
//       }),
//       inject: [ConfigService],
//     }),
    
//   ],
// })
// export class AppModule implements OnModuleInit {
//   constructor(
//     private readonly rolesService: RolesService,
//     private readonly menuService: MenuService,
//   ) {}

//   async onModuleInit() {
//     // Seed roles por defecto
//     await this.rolesService.seedDefaultRoles();
    
//     // Seed menu por defecto
//     await this.menuService.seedDefaultMenu();
    
//     console.log('Sistema inicializado con datos por defecto');
//   }
// }


