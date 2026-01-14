import { Module, OnModuleInit } from '@nestjs/common';
import { ClientesModule } from './clientes/clientes.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductosModule } from './productos/productos.module';
import { AuthModule } from './auth/auth.module';
import { FacturasVentasModule } from './facturas-ventas/facturas-ventas.module';
import { RolesModule } from './roles/roles.module';
import { MenuModule } from './menu/menu.module';
import { RolesService } from './roles/roles.service';
import { MenuService } from './menu/menu.service';

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

export class AppModule implements OnModuleInit {

  constructor(
    private readonly rolesService: RolesService,
    private readonly menuService: MenuService,
  ) {}

  async onModuleInit() {
    // Seed roles por defecto
    await this.rolesService.seedDefaultRoles();
    
    // Seed menu por defecto
    await this.menuService.seedDefaultMenu();
    
    console.log('Sistema inicializado con datos por defecto');
  }

}


