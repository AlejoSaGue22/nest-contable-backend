import { Module, OnModuleInit } from '@nestjs/common';
import { ClientesModule } from './clientes/clientes.module';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { FacturasVentasModule } from './facturas-ventas/facturas-ventas.module';
import { RolesModule } from './roles/roles.module';
import { MenuModule } from './menu/menu.module';
import { RolesService } from './roles/roles.service';
import { MenuService } from './menu/menu.service';
import { ProveedoresModule } from './proveedores/proveedores.module';
import { FacturasComprasModule } from './facturas-compras/facturas-compras.module';
import { CuentasModule } from './cuentas/cuentas.module';
import { AsientosContablesModule } from './asientos-contables/asientos-contables.module';
import { ReportesModule } from './reportes/reportes.module';
import { ArticulosModule } from './articulos/articulos.module';
import { CuentasService } from './cuentas/cuentas.service';
import { DataSource } from 'typeorm';

@Module({
  imports: [TypeOrmModule.forRoot({
    type: 'mysql',
    host: 'localhost',
    port: 3307,
    username: 'root',
    password: 'root',
    database: 'finance_tejo',
    autoLoadEntities: true,
    synchronize: true
  }),
    ClientesModule,
    UsersModule,
    AuthModule,
    FacturasVentasModule,
    RolesModule,
    MenuModule,
    ProveedoresModule,
    FacturasComprasModule,
    ArticulosModule,
    CuentasModule,
    AsientosContablesModule,
    ReportesModule],
  controllers: [],
})

export class AppModule implements OnModuleInit {

  constructor(
    private readonly rolesService: RolesService,
    private readonly menuService: MenuService,
    private readonly cuentasService: CuentasService,
    private datasource: DataSource
  ) { }

  async onModuleInit() {
    // Seed roles por defecto
    await this.rolesService.seedDefaultRoles();

    // Seed menu por defecto
    await this.menuService.seedDefaultMenu();

    await this.cuentasService.seedCuentasBasicas(this.datasource)

    console.log('Sistema inicializado con datos por defecto');
  }

}


